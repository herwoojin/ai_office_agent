# AI Office Agents — 실행 파일 가이드

CLI / IDE 없이 **더블클릭** 한 번으로 가동하는 macOS / Windows 런처입니다.

## 빌드된 결과물

```
dist/
├── launchers/
│   ├── macos/
│   │   ├── AI Office 시작.app
│   │   ├── AI Office 중지.app
│   │   └── README.txt
│   └── windows/
│       ├── AI Office 시작.cmd          (= start.cmd)
│       ├── AI Office 중지.cmd          (= stop.cmd)
│       ├── AI Office 설치.cmd          (= install.cmd)
│       ├── AI-Office-Start.vbs         (콘솔 안 보임)
│       ├── AI-Office-Stop.vbs
│       └── README.txt
├── AI-Office-Launchers-macOS.zip
└── AI-Office-Launchers-Windows.zip
```

## 빌드 방법

```bash
bash scripts/build-launchers.sh
```

위 스크립트가 macOS .app 두 개 + Windows .cmd/.vbs 패키지를 생성하고 두 플랫폼용 .zip 도 만듭니다.

## 사용자에게 배포

| 플랫폼 | 전달 파일 | 설치 방법 |
|--------|-----------|-----------|
| macOS  | `AI-Office-Launchers-macOS.zip` | 압축 풀고 `.app` 두 개를 `/Applications` 로 드래그 |
| Windows| `AI-Office-Launchers-Windows.zip` | 압축 풀고 `AI Office 설치.cmd` 더블클릭 |

런처는 프로젝트 폴더가 다음 위치에 있다고 가정합니다 (자동 탐색):

- `~/ai-office-agents`
- `~/Documents/ai-office-agents`
- `/Applications/AI-Office-Agents` (macOS)
- `%USERPROFILE%\ai-office-agents` (Windows)
- 또는 환경변수 `AI_OFFICE_HOME=<폴더경로>`

## 동작 시퀀스

### 시작
1. 포트 3000이 이미 LISTEN이면 → "이미 가동 중" 안내 + 브라우저만 열기
2. 그렇지 않으면:
   - OpenClaw 게이트웨이 (`openclaw gateway --port 18789`) 백그라운드 가동
   - `npm run dev` 로 DeskRPG dev-server 백그라운드 가동
   - 최대 60초 동안 포트 3000 LISTEN 또는 "Dev server ready" 로그 대기
   - 준비되면 브라우저로 `http://localhost:3000` 자동 오픈

### 중지
- 포트 3000 / 13000 점유 프로세스 종료
- OpenClaw (18789) 는 사용자에게 별도로 묻고 종료

## 전제 조건

- Node.js 20+ ([nodejs.org](https://nodejs.org/ko) LTS)
- OpenClaw CLI: `npm install -g openclaw` (없어도 UI 는 켜지지만 NPC 응답 없음)
- macOS 11+ / Windows 10+

## 첫 실행 시 OS 보안 경고

| OS | 차단 메시지 | 해제 방법 |
|----|------------|----------|
| macOS | "확인되지 않은 개발자" | 시스템 설정 → 개인정보 보호 및 보안 → "확인 없이 열기" |
| Windows | "PC를 보호했습니다" (SmartScreen) | "추가 정보" → "실행" |

서명되지 않은 스크립트라서 발생하는 정상 경고입니다.

## 신호 / 시그널

| 신호 | 의미 | 위치 |
|------|------|------|
| 포트 3000 LISTEN | DeskRPG dev-server 가동 | `netstat -an / lsof -i :3000` |
| 포트 18789 LISTEN | OpenClaw 게이트웨이 가동 | `lsof -i :18789` |
| `logs/deskrpg.log` "Dev server ready" | Next.js HTTP 서버 준비 완료 | 로그 파일 |
| `.pids/deskrpg.pid` | dev-server 자식 프로세스 PID | (macOS 만 작성) |

## 한계 / 다음 단계

- 진정한 단일 .exe / 단일 .app 으로 만들려면 Electron 또는 Tauri 로 감싸야 합니다. 현재 런처는 **이미 설치된 Node.js + 프로젝트 폴더** 를 가정하는 가벼운 wrapper 입니다.
- 처음 설치하는 사람은 macOS 의 [`install.command`](install.command) 또는 Windows 의 `AI Office 설치.cmd` 를 한 번 돌려야 합니다.
- 코드 사이닝(Apple Developer ID / Authenticode) 은 적용 안 됐어요. 사내 배포 또는 신뢰된 사용자 대상 배포용입니다.

---

## 🪟 진짜 단일 실행 파일 (.app / .exe) — Electron 빌드

Node.js 가 없는 사용자에게도 “더블클릭만 하면 가동”되게 하려면 Electron 으로 감싸야 합니다.
이미 [`desk_rpg_model/electron/main.js`](desk_rpg_model/electron/main.js) 에 구현돼 있고, `electron-builder` 설정은 [`desk_rpg_model/package.json`](desk_rpg_model/package.json) 의 `build` 키에 들어있어요.

### 동작 원리

1. Electron 메인 프로세스가 **OpenClaw 게이트웨이** 와 **dev-server.ts** 를 자식 프로세스로 띄움
2. 포트 3000 이 LISTEN 되면 BrowserWindow 가 `http://localhost:3000` 로드
3. 사용자가 보기엔 “브라우저처럼 생긴 단독 앱” — 그러나 내부는 풀 dev 서버 환경 그대로
4. 앱 종료 시 자식 프로세스 모두 정리 (트레이 메뉴에서 “종료”)

### 로컬 개발 실행 (Electron 윈도우만 띄우기)

```bash
cd desk_rpg_model
npm run electron:dev
```

### 빌드 명령

```bash
cd desk_rpg_model

# 현재 OS 용
npm run electron:build

# 특정 플랫폼
npm run electron:build:mac   # → dist/electron/*.dmg, *.zip (arm64 + x64)
npm run electron:build:win   # → dist/electron/*.exe (NSIS 설치파일 + portable)

# 둘 다 (Windows .exe 는 macOS 에서 빌드하려면 wine 필요)
npm run electron:build:all
```

### macOS 에서 Windows .exe 같이 빌드하기 (GitHub Actions 추천)

macOS 에서 Windows 실행파일을 직접 빌드하면 `wine` 의존성 때문에 깨지기 쉽습니다. 그래서 [`.github/workflows/build-electron.yml`](.github/workflows/build-electron.yml) 워크플로를 같이 넣어 뒀어요.

**사용법**:
1. GitHub 에 푸시
2. Actions 탭 → “Build Electron App” → “Run workflow” (수동 실행)
3. macOS 러너 + Windows 러너에서 **동시 빌드**
4. Artifacts 탭에서 `AI-Office-Agents-macOS.zip` / `AI-Office-Agents-Windows.zip` 다운로드
5. `git tag v1.0.0 && git push --tags` 하면 자동으로 GitHub Release 에 첨부됨

### 산출물 위치

```
dist/electron/
├── AI Office Agents-1.0.0-arm64.dmg     (macOS Apple Silicon)
├── AI Office Agents-1.0.0-x64.dmg       (macOS Intel)
├── AI Office Agents-1.0.0-arm64-mac.zip
├── AI Office Agents-1.0.0-x64-mac.zip
├── AI Office Agents Setup 1.0.0.exe     (Windows NSIS 설치파일)
└── AI Office Agents 1.0.0.exe           (Windows 포터블 .exe)
```

### Electron 앱의 의존성

- **번들됨**: Next.js, dev-server, node_modules, SQLite native module, 모든 게임 자산
- **번들 안 됨 (외부 설치 필요)**: OpenClaw CLI
  - 이유: openclaw 는 사용자별 인증/모델 셋업이 분리돼 있고, 이미 설치된 인스턴스를 재활용하는 게 합리적
  - 해결: 앱 첫 실행 시 openclaw 없으면 “Homebrew 또는 `npm i -g openclaw` 로 설치하세요” 다이얼로그를 띄움 (main.js 에서 처리)

### Splash 화면 + 트레이

- 부팅 중 splash 윈도우에 “OpenClaw 게이트웨이 확인 중 …”, “DeskRPG 개발 서버 시작 중 …” 같은 상태 표시
- 메뉴바/시스템 트레이에 “창 보이기 / 브라우저에서 열기 / 종료” 메뉴
- 창 닫아도 macOS 는 트레이로 살아있음 (Cmd+Q 로만 종료)

### 사이즈 / 성능

- 빌드 산출물: macOS dmg 약 150~200MB, Windows exe 약 130~180MB
- 메모리: 평소 ~250MB (Chromium 100MB + Node 80MB + dev-server 70MB)
- 첫 실행: 의존성 압축 해제 + dev-server 부팅으로 30~60초 소요

### 코드 사이닝

기본 빌드는 **서명 안 함** (`identity: null`). 처음 실행 시 OS 경고가 뜸:
- macOS: “확인되지 않은 개발자” → 시스템 설정 → 확인 없이 열기
- Windows: SmartScreen 차단 → 추가 정보 → 실행

진짜 배포하려면:
- macOS: Apple Developer Program 가입 ($99/년) → Developer ID 인증서 → `notarize` 옵션 활성화
- Windows: Authenticode 인증서 구입 ($200~600/년) → `signtool` 로 서명

→ 사내/소수 사용자 대상이라면 그냥 서명 없이 배포해도 충분합니다.

### 서버리스 배포는 가능한가?

**별도 문서**: [SERVERLESS-DEPLOY.md](SERVERLESS-DEPLOY.md) 에 Netlify / Vercel / Cloudflare 분석 + 4가지 마이그레이션 경로를 정리했습니다. 요약하면:
- 현재 코드 그대로는 세 플랫폼 다 풀스택 배포 불가 (Socket.IO + SQLite 파일 + OpenClaw subprocess 가 충돌)
- 가장 쉬운 길: Docker 그대로 Render/Railway 호스팅
- 가장 클라우드 네이티브: Cloudflare Workers + Durable Objects + D1 + R2 (재작성 3~5일)
