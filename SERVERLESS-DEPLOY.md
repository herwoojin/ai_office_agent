# 서버리스 배포 가능성 분석 — Netlify / Vercel / Cloudflare

> **TL;DR**
> 지금 코드 그대로는 **세 플랫폼 다 풀스택 배포 불가능**합니다.
> 이유: Socket.IO, 영구 SQLite 파일, OpenClaw CLI subprocess, 인프로세스 스케줄러 — 모두 "serverless function" 모델과 충돌해요.
> 다만 각 플랫폼에 맞춰 **부품을 갈아끼우면 가능**하며, 어느 정도 갈아끼울지에 따라 4가지 경로가 있습니다.

---

## 왜 “그대로 올리면 안 되는지” — 충돌 지점

| 구성 요소 | 문제 | 영향 |
|---|---|---|
| `dev-server.ts` (커스텀 HTTP + Socket.IO 서버) | Serverless function 은 short-lived. WebSocket 영구 연결 불가 | 게임 화면 실시간 통신 죽음 |
| `better-sqlite3` (파일 DB) | Serverless FS 는 read-only / 휘발성 | 로그인, 캐릭터, 채널, NPC 데이터 모두 사라짐 |
| `openclaw` CLI subprocess (`execFile`) | Serverless 는 시스템 바이너리 실행 X | NPC 응답 0% |
| 정기 보고서 (인프로세스 setInterval + 파일 저장) | 함수가 매번 새로 부팅 → 타이머 유지 X, 파일 휘발 | 정시 보고 동작 안 함 |
| Telegram polling / 24/7 wander loop | 영구 백그라운드 프로세스 필요 | 자동 운영 죽음 |
| Phaser 게임 클라이언트 | ✅ 정적 자산 — 어디든 OK | 영향 없음 |
| Next.js 라우팅 / SSR | ✅ 세 플랫폼 모두 지원 | 영향 없음 |

---

## 플랫폼별 적합도

### 1. Netlify — ❌ 풀스택 불가, 랜딩만 가능

이미 [NETLIFY.md](NETLIFY.md) 에 정리됨. 요약:
- WebSocket 지원 안 함 (Edge Function 도 마찬가지)
- Netlify Functions 는 10초 (Pro 26초) 타임아웃 → LLM 스트리밍 길면 끊김
- 파일시스템 비영구
- **권장 사용처**: `/demo`, `/auth`, 랜딩 페이지만 정적 호스팅. 실제 게임 서버는 다른 곳.

### 2. Vercel — ⚠️ 절반만 가능

| 항목 | Vercel 가능 여부 | 필요한 변경 |
|---|---|---|
| Next.js (App Router, SSR, API Routes) | ✅ 네이티브 지원 | 없음 |
| 커스텀 HTTP 서버 (`dev-server.ts`) | ❌ Vercel 은 `next start` 기반 | `dev-server.ts` 의 RPC/소켓 셋업을 별 호스트로 분리 |
| Socket.IO | ❌ Serverless 함수 위에 못 띄움 | **Pusher, Ably, Soketi (self-host), Vercel Realtime** 등 외부 PubSub 로 대체 |
| SQLite 파일 | ❌ FS 비영구 | **Vercel Postgres / Neon / Turso (LibSQL)** 로 마이그레이션. 코드는 이미 Drizzle 이라 비교적 쉬움 (`schema.ts` Postgres 버전 그대로 활용) |
| OpenClaw CLI subprocess | ❌ 시스템 바이너리 실행 불가 | **각 LLM API 직접 호출** (Anthropic SDK / OpenAI SDK / Google AI SDK) — 에이전트 라우팅을 코드로 다시 작성 |
| 정기 보고서 스케줄러 | ⚠️ Vercel Cron 으로 가능 | 인프로세스 setInterval → `app/api/cron/reports/route.ts` 로 옮기고 [vercel.json](https://vercel.com/docs/cron-jobs) crons 등록. 파일 저장은 **Vercel Blob / S3** |
| Telegram polling | ❌ 영구 프로세스 X | Telegram **Webhook** 으로 전환 |
| 빌드 시간 / 함수 크기 | Hobby 100MB / Pro 250MB | 의존성 가지치기 (sharp, canvas 등 제거) |

**소요**: 2~3일 작업. 가장 큰 부분은 (1) Socket.IO → Pusher 패턴 마이그레이션 (2) OpenClaw 호출 → 직접 LLM SDK 호출.

### 3. Cloudflare — ✅ 가장 잘 맞음 (단, 재작성량 큼)

| 항목 | CF 가능 여부 | 어떻게 |
|---|---|---|
| Next.js | ✅ **Cloudflare Pages** + `@cloudflare/next-on-pages` 어댑터 | 빌드만 다시 |
| WebSocket | ✅ **Durable Objects** | 채널 1개 = DO 1개. 진짜 stateful WebSocket 지원 |
| SQLite | ✅ **D1** (SQLite-compatible) 또는 DO 내 SQLite | Drizzle D1 어댑터 존재 |
| 파일 저장 | ✅ **R2** (S3 호환) | 정기 보고서 .md 파일 R2 에 저장 |
| Cron | ✅ **Workers Cron Triggers** | 매 분 트리거로 schedule 체크 |
| Subprocess (OpenClaw) | ❌ Workers 는 V8 isolate — 시스템 바이너리 실행 불가 | **LLM SDK 직접 호출** 로 대체 (Vercel 과 동일) |
| Long-lived process | ✅ Durable Object 가 그 역할 | wander loop, telegram poller 모두 DO 에서 작동 |
| 비용 | ✅ Workers Paid $5/mo + DO usage | 가장 저렴 |

**소요**: 3~5일. CF Workers + DO + D1 + R2 패턴이 익숙해야 함. 다만 풀-서버리스 운영이 가능한 유일한 옵션.

---

## 4가지 실행 경로

### 경로 A — 자체 호스팅 (Docker, 가장 빠름) ⏱ 1일

지금 코드 그대로 + `docker-compose`. **변경 없음**.

```bash
# desk_rpg_model 에 이미 있는 docker 구성
cd desk_rpg_model
docker compose up -d
```

- **Render** / **Railway** / **Fly.io** / **VPS** 에 그대로 배포
- 도메인 + SSL 만 붙이면 끝
- 단점: 24/7 인스턴스 비용 ($5~10/월)

✅ **추천 — 가장 빠른 출시 경로**

### 경로 B — 하이브리드 (Netlify 랜딩 + Render 게임서버) ⏱ 1~2일

- `/` 와 `/demo` 는 Netlify 정적 호스팅
- `/game`, `/api/*`, `/socket.io/*` 는 Render 호스팅의 dev-server 로 리다이렉트
- 이미 `netlify.toml` 에 redirect 스텁이 있어요. 환경변수 `GAME_SERVER_URL` 설정 후 주석 해제만 하면 됨

마케팅 페이지를 빠른 CDN 으로, 실제 서버는 별도로 — 가장 균형 잡힌 선택.

### 경로 C — Vercel 완전 이전 ⏱ 2~3일

체크리스트:
- [ ] `dev-server.ts` 제거 → `next start` 로 전환
- [ ] Socket.IO → Pusher/Ably (또는 Vercel Realtime 베타)
- [ ] `better-sqlite3` → `@vercel/postgres` 또는 Neon
- [ ] OpenClaw subprocess → Anthropic/OpenAI/Google SDK 직접 호출
- [ ] 정기 보고서 → `/api/cron/reports` + `vercel.json` crons
- [ ] 파일 저장 → Vercel Blob
- [ ] Telegram → Webhook 전환

### 경로 D — Cloudflare 완전 이전 (가장 클라우드 네이티브) ⏱ 3~5일

체크리스트:
- [ ] `@cloudflare/next-on-pages` 어댑터 적용
- [ ] Socket.IO → Durable Objects WebSocket
- [ ] SQLite → D1 (Drizzle D1 어댑터)
- [ ] OpenClaw 제거 → LLM SDK 직접 호출
- [ ] 정기 보고서 → Workers Cron + R2
- [ ] Wander loop → 1개 Durable Object 에 위치
- [ ] `wrangler.toml` 셋업

✅ **추천 — 장기적으로 가장 저렴/확장 가능**

---

## 어느 경로를 골라야 하나

| 우선순위 | 추천 경로 |
|---|---|
| **지금 당장 친구/팀에게 보여주기** | **경로 A** (Render/Railway + Docker) — 코드 변경 0 |
| **개인 사용/소수 운영** | **데스크탑 Electron 앱** (이번에 만든 거) — 호스팅 비용 0 |
| **공개 SaaS 런칭** | **경로 B** (Netlify + Render) — 마케팅과 운영 분리 |
| **트래픽 폭증 대비 / 비용 최적화** | **경로 D** (Cloudflare 풀-서버리스) |

> 코드는 이미 Drizzle ORM 을 쓰고 LLM 추상화 레이어(OpenClaw)가 있어, **경로 C/D 로의 마이그레이션 난이도는 보통 수준**입니다. 다만 한 번에 모든 의존성을 갈아끼우진 마시고, 위 체크리스트 순서로 한 줄씩 끊어가세요.
