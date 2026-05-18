# 🌐 Netlify 배포 가이드

> ⚠️ **먼저 솔직히** — 이 프로젝트는 Netlify에 **완전 배포 불가능**합니다.
> 핵심 기능 일부가 Netlify의 서버리스 모델과 맞지 않거든요.
> 이 문서는 (1) 무엇이 안 되는지 (2) 어디까지 되는지 (3) 환경변수 가이드 를 설명합니다.

---

## ❌ Netlify에서 동작하지 않는 부분

| 기능 | 이유 | 대안 |
|---|---|---|
| **Socket.IO 실시간 통신** | Netlify는 WebSocket 영구 연결 불가 | Render / Railway / Fly.io |
| **NPC 자율 산책 loop** | 서버 측 setInterval (영구 프로세스 필요) | 같은 위 |
| **OpenClaw CLI 호출** (`openclaw agent ...`) | 시스템 바이너리 미설치 | Render with Docker / 자체 VPS |
| **SQLite 파일 DB** | Netlify 파일시스템 비영구 | Postgres / Firestore / Supabase |
| **텔레그램 폴러** | 영구 polling 불가 | Webhook 방식으로 전환 (Edge Function) |
| **HTTP 트리거 서버 (:13000)** | 별도 포트 listen 불가 | Netlify Functions로 마이그레이션 |

➡️ **결론**: 게임 자체(2D 사무실 + 회의 + LLM) 를 Netlify에서 운영할 순 없습니다.

---

## ✅ Netlify에서 동작 가능한 부분

다음만 배포한다면 가능합니다:

- **`/demo` 페이지** — 데모 영상 + 스크린샷 + 가이드 (정적, Socket.IO 미사용)
- **`/auth` 페이지** — Firebase Google 로그인 UI만 보여주기
- **랜딩 / 마케팅 페이지** — 정적 콘텐츠

> 즉, Netlify는 "데모 쇼케이스 / 랜딩 페이지"로 쓰고,
> 실제 게임 서버는 별도 호스팅 (Render/Railway 권장).

---

## 🎯 권장 아키텍처 (실제 운영)

```
┌────────────────────────┐      ┌─────────────────────────────┐
│   Netlify              │      │   Render / Railway          │
│   (랜딩 + 데모)         │      │   (Next.js + Socket.IO)     │
│   yourdomain.com       │ ───→ │   game.yourdomain.com       │
└────────────────────────┘      └──────────────┬──────────────┘
                                                │
                                                ▼
                                  ┌─────────────────────────────┐
                                  │  사용자 PC (또는 VPS)         │
                                  │  - OpenClaw 게이트웨이       │
                                  │  - LLM API 키들 보관         │
                                  └─────────────────────────────┘
```

---

## ⚙️ Netlify 배포할 경우 — 환경변수 가이드

만약 위의 한계를 알고도 **로그인/데모 페이지만이라도** 배포한다면, Netlify 사이트 설정 → **Environment variables**에 다음을 추가하세요.

### 🔴 필수 (있어야 빌드 / 로그인 성공)

| 변수명 | 예시 값 | 설명 |
|---|---|---|
| `JWT_SECRET` | `랜덤 64자 문자열` | 쿠키 JWT 서명 키. 절대 깃에 안 들어가게! `openssl rand -hex 32` 로 생성 |
| `INTERNAL_RPC_SECRET` | `또 다른 랜덤 64자` | 게이트웨이 토큰 암호화 키 (선택, 없으면 JWT_SECRET 사용) |
| `DB_TYPE` | `sqlite` 또는 비움 | ⚠️ **Netlify에선 SQLite 비영구**. Postgres 권장 |
| `DATABASE_URL` | `postgresql://...` | Postgres URL (Supabase, Neon, Railway 등) |
| `NODE_ENV` | `production` | 자동 설정됨 |
| `COOKIE_SECURE` | `true` | HTTPS 배포라 true |

### 🟡 Firebase 인증 (Google 로그인 동작용)

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBIIfQGK4vii1yaCxUyP36Zu2kiIsN0ceg
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=desk-rpg-a2edb.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=desk-rpg-a2edb
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=desk-rpg-a2edb.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=540813976664
NEXT_PUBLIC_FIREBASE_APP_ID=1:540813976664:web:10b816aa2d0c57dc65562d
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-YE578G2ZR3
```

> 💡 **NEXT_PUBLIC_** 접두어가 붙은 변수는 클라이언트 번들에 포함됩니다. Firebase Web Config는 원래 공개되어도 안전합니다 (Firestore 보안 규칙으로 보호).

> ⚠️ 현재 `src/lib/firebase-client.ts` 에 값이 하드코딩되어 있으니, 위 env 변수로 동작하게 하려면 코드를 수정해야 합니다. (`/firebase` 폴더의 README 참고)

### 🟠 LLM Provider (Netlify Functions가 호출 시)

```
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-api03-...
GOOGLE_AI_API_KEY=AIzaSy...
```

> ⚠️ Netlify Functions로 LLM 호출은 가능하지만, 30초 실행 한도 (Pro 26초 / Enterprise 가변) 가 있습니다. Claude/GPT 한 턴이 25~30초 걸리므로 마지노선입니다.

### 🟢 메시징 채널 (옵션)

```
TELEGRAM_BOT_TOKEN=7654321098:AAGxxxxxxx
TELEGRAM_ALLOWED_USERS=123456789
```

> ⚠️ Telegram 폴링은 Netlify에서 불가. **Webhook** 방식으로 전환해야 합니다:
> ```
> https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourdomain.netlify.app/api/telegram/webhook
> ```
> 그러면 Netlify Function 한 번 호출로 메시지 처리 가능.

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_REPORT_CHANNEL=C0XXXXXX
```

### ⚫ Netlify에서 사용 불가 (참고용)

다음은 Netlify에 넣어도 무용지물입니다 (CLI 바이너리 / 로컬 호스트 의존):

```
OPENCLAW_URL=ws://127.0.0.1:18789    # 로컬 호스트 — 불가
OPENCLAW_TOKEN=...                    # CLI 호출 안 됨
OFFICE_TRIGGER_PORT=13000             # 별도 포트 불가
DESKRPG_HOME=...                      # 파일시스템 비영구
```

---

## 📝 netlify.toml 예시

저장소 루트에 `netlify.toml` 추가하면 자동 인식:

```toml
[build]
  base = "desk_rpg_model"          # Next.js 앱 위치
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"
  NEXT_TELEMETRY_DISABLED = "1"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# COOP 헤더 (Firebase Google 팝업용)
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin-allow-popups"
```

---

## 🛠️ Netlify 배포 단계 (제한 인지하고 진행)

1. **Netlify 가입** + GitHub 연동 → 저장소 선택
2. **Build settings**:
   - Base directory: `desk_rpg_model`
   - Build command: `npm run build`
   - Publish directory: `desk_rpg_model/.next`
3. **Environment variables** 입력 (위 표 참고)
4. **Deploy site** 클릭
5. 빌드 로그에 `Cannot find module` 등 에러 나면:
   - `package.json` 의 `dependencies` 확인
   - `next.config.ts` 의 `output: "standalone"` 옵션 확인 (Netlify Next.js 플러그인이 처리)

---

## 🚀 더 나은 대안 — 한 줄 배포 가능한 플랫폼

| 플랫폼 | 무료 티어 | Socket.IO | OpenClaw | 추천 이유 |
|---|---|---|---|---|
| **Render** | ✅ 750 hr/월 | ✅ | ⚠️ (Docker 필요) | 가장 무난, Postgres 무료 |
| **Railway** | $5 크레딧/월 | ✅ | ✅ (Dockerfile) | DX 좋음, DB 통합 |
| **Fly.io** | ✅ 256MB × 3 | ✅ | ✅ (Docker) | 글로벌 엣지, persistent volume |
| **Vercel** | ✅ Hobby | ❌ | ❌ | Next.js 최강이나 Socket.IO 불가 |

### 가장 빠른 길 (Render)

```bash
# 1) GitHub repo 에 Dockerfile 추가 (이미 있음: desk_rpg_model/Dockerfile)
# 2) https://render.com 에서 "New Web Service" → repo 선택
# 3) Environment Variables 추가
# 4) Deploy
```

OpenClaw 게이트웨이는 **로컬 또는 별도 VPS** 에서 돌리고, Render의 Next.js 가 그쪽으로 연결하도록 `OPENCLAW_URL` 만 외부 주소로 설정.

---

## 🔐 환경변수 보안 체크리스트

배포 전 확인:

- [ ] `.env.local` 은 git 에 없다 (`.gitignore` 적용됨 ✓)
- [ ] `JWT_SECRET` 은 64자 이상 랜덤 (`openssl rand -hex 32`)
- [ ] `INTERNAL_RPC_SECRET` 도 별도 랜덤 (선택)
- [ ] Firebase apiKey는 NEXT_PUBLIC_ 접두어 (의도된 공개)
- [ ] LLM API 키는 NEXT_PUBLIC_ 절대 붙이지 말기 (서버사이드만)
- [ ] Firebase **Authorized domains** 에 Netlify 도메인 추가
  (Console → Authentication → Settings → Authorized domains)
- [ ] OpenClaw 게이트웨이 토큰은 Netlify 환경변수에 직접 안 넣기
  (Netlify Functions에서 LLM 직접 호출하는 구조라면 LLM 키만)

---

## 💡 솔직한 추천

이 프로젝트의 핵심 (디지털 트윈 + Socket.IO + OpenClaw) 은 **Netlify에 어울리지 않습니다**.

**현실적 선택지**:

1. **데모만 보여주려면** → Netlify에 `/demo` + 정적 페이지만 배포. 게임은 "로컬에서 npm run dev" 권장
2. **실제 운영하려면** → Render / Railway 에 Docker로 배포 + 클라이언트가 외부 OpenClaw 게이트웨이 연결
3. **완전 서버리스로 가려면** → 큰 리팩토링 필요:
   - Socket.IO → Pusher / Ably / Supabase Realtime
   - SQLite → Firestore (이미 `/firebase/firestore.rules` 준비됨)
   - OpenClaw → 직접 OpenAI/Anthropic/Google SDK 호출 (Edge Function)

3번 방향이라면 우리가 이미 만든 `/firebase` 폴더의 Firestore 룰이 베이스가 됩니다.
