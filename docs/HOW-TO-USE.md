# 🎯 실행 파일 사용 가이드 — 어디서 어떻게 쓰나요?

> 만들어진 실행 파일이 두 종류 있습니다:
> ① **본인 맥북용 .app** (자기가 매일 쓰는 것)
> ② **다른 사람 배포용 install.command** (지인/팀원이 같은 환경 만들 때)

---

## ① 본인 맥북에서 매일 사용

### 무엇이 만들어졌나?

`~/Applications/` 폴더에 두 개의 .app:

| 아이콘 | 이름 | 역할 |
|---|---|---|
| 🏢 | **AI Office 시작.app** | 더블클릭 → 친절한 팝업 → 서버 가동 |
| 🛑 | **AI Office 중지.app** | 더블클릭 → 안전하게 정지 |

### 어디서 실행하나?

3가지 방법 (편한 거 선택):

#### 방법 A — Finder
1. Finder 에서 **Applications** 폴더 (`Shift+Cmd+A`)
2. "AI Office 시작.app" 더블클릭

#### 방법 B — Dock 에 고정 (가장 편함)
1. Applications 폴더에서 "AI Office 시작.app" 우클릭 → **Options → Keep in Dock**
2. 이제 Dock 클릭 한 번으로 실행

#### 방법 C — Spotlight
1. `Cmd+Space` → "AI Office" 타이핑 → Enter

### 실행하면 어떤 일이 일어나나?

**Case 1 — 처음 가동 시** (아무것도 실행 중 아님):

```
┌──────────────────────────────────────────┐
│  🏢 AI Office Agents 시작                 │
│                                          │
│  3명의 AI 직원이 가상 사무실에서          │
│  일하고 회의하는 시스템을 시작합니다.     │
│                                          │
│  무엇이 켜지나요?                         │
│   • OpenClaw 게이트웨이                  │
│   • DeskRPG 서버                         │
│   • 텔레그램/슬랙/디스코드 봇             │
│                                          │
│  소요 시간: 20~30초                       │
│                                          │
│  [취소]  [시작]                          │
└──────────────────────────────────────────┘
```

[시작] 클릭 → 알림 센터로 진행 상황 표시 → 약 30초 후:

```
┌──────────────────────────────────────────┐
│  ✅ AI Office Agents 가동 완료            │
│                                          │
│  📡 DeskRPG:     http://localhost:3000   │
│  🛠 설정 허브:   http://localhost:3000/  │
│                  setup                   │
│  📺 데모:        http://localhost:3000/  │
│                  demo                    │
│                                          │
│  🤖 메신저 봇:                           │
│   ✅ 텔레그램  (토큰 입력된 경우)          │
│   ❌ 슬랙       (.env.local 에 토큰 추가)  │
│   ❌ 디스코드   (.env.local 에 토큰 추가)  │
│                                          │
│  [닫기]  [설정 허브 열기]  [오피스 입장]   │
└──────────────────────────────────────────┘
```

**Case 2 — 이미 가동 중일 때**:

```
┌──────────────────────────────────────────┐
│  🟢 AI Office Agents — 가동 중            │
│                                          │
│  이미 실행 중입니다.                      │
│                                          │
│  📡 DeskRPG:    http://localhost:3000    │
│  🛠 설정 허브:  /setup                    │
│  📺 데모:      /demo                     │
│  🤖 OpenClaw:  ws://127.0.0.1:18789     │
│                                          │
│  [닫기]  [로그 보기]  [브라우저 열기]      │
└──────────────────────────────────────────┘
```

**Case 3 — 에러 발생 시**: 자동으로 로그 마지막 20줄 보여주고 로그 파일 열기.

### 중지하려면?

**AI Office 중지.app** 더블클릭 → 팝업:

```
┌──────────────────────────────────────────┐
│  🛑 AI Office Agents 중지                 │
│                                          │
│  현재 가동 중:                            │
│   📡 DeskRPG (3000):   ✓ 가동 중         │
│   🛠 Trigger (13000):  ✓ 가동 중         │
│   🤖 OpenClaw (18789): ✓ 가동 중         │
│                                          │
│  무엇을 중지할까요?                       │
│                                          │
│  [취소]  [DeskRPG 만]  [전체 중지]        │
└──────────────────────────────────────────┘
```

- **DeskRPG 만**: 채팅 서버만 끔. OpenClaw 는 다른 작업에 쓰는 경우 살려둠.
- **전체 중지**: 셋 다 끔.

---

## 🚨 첫 실행 시 macOS 보안 경고

처음 더블클릭하면 macOS 가 차단할 수 있습니다:

```
"AI Office 시작" cannot be opened because Apple cannot
check it for malicious software.
```

해결 방법 (1회만):

**옵션 1 — 우클릭으로 한번에**:
1. .app 우클릭 → **Open** 선택
2. 다시 한번 "Open" 클릭

**옵션 2 — 시스템 설정**:
1. System Settings → **Privacy & Security**
2. 스크롤 내려서 *"AI Office 시작 was blocked..."* 메시지
3. **Open Anyway** 클릭

이후엔 평소처럼 더블클릭만으로 동작.

---

## ② 다른 사람에게 배포할 때

다른 사람 맥북에 같은 환경을 만들어주려면 **install.command** 사용.

### 1단계 — 파일 받기

다른 사람에게 다음 중 하나 전달:

#### A. 한 줄 명령 (가장 간단)
이 한 줄을 보내고 "터미널에 붙여넣고 Enter" 라고 안내:
```bash
curl -fsSL https://raw.githubusercontent.com/herwoojin/ai_office_agent/main/install.command -o ~/Downloads/ai-office-install.command && chmod +x ~/Downloads/ai-office-install.command && open ~/Downloads/ai-office-install.command
```

#### B. install.command 파일 직접 보내기
1. https://github.com/herwoojin/ai_office_agent 에서 [install.command](../install.command) 다운로드
2. 카톡/슬랙/이메일/USB 등으로 전달
3. 받은 사람이 더블클릭

#### C. GitHub release 페이지
1. 본인이 GitHub release 생성 → install.command 첨부
2. 다운로드 링크 공유

### 2단계 — 받은 사람의 사용 흐름

다른 사람이 install.command 더블클릭 시:

```
┌──────────────────────────────────────────┐
│  🏢 AI Office Agents — 원클릭 설치        │
│                                          │
│  설치되는 것:                             │
│   • Homebrew (없으면)                    │
│   • Node.js 20+, Git, OpenClaw           │
│   • AI Office Agents 저장소              │
│   • macOS .app 번들                      │
│                                          │
│  소요 시간: 10~15분 (네트워크 속도 따라)  │
│                                          │
│  [취소]  [설치 시작]                     │
└──────────────────────────────────────────┘
```

[설치 시작] 클릭 → 8단계 자동 진행:
1. Homebrew 확인 / 설치
2. Node.js, git, OpenClaw 설치
3. 저장소 클론 (~/ai-office-agents)
4. desk_rpg_model 의존성 설치
5. SQLite DB 초기화 + .env.local 템플릿
6. NPC 프리셋 + OpenClaw 페어링
7. macOS .app 번들 빌드
8. 완료 안내 팝업

각 단계마다 macOS 알림 센터에 진행 상황 표시.

### 3단계 — 받은 사람이 추가로 해야 할 일

install.command 완료 후, 받은 사람은:

1. **본인 API 키 발급** (LLM 비용 본인 부담)
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com/settings/keys
   - Google: https://aistudio.google.com/apikey
2. **~/ai-office-agents/.env.local** 파일 열어서 키 붙여넣기
3. **본인 Firebase 프로젝트** 만들고 설정 교체 (Google 로그인 쓸 경우)
4. **본인 텔레그램/슬랙/디스코드 봇** 생성 후 토큰 입력

자세한 가이드는 받은 사람도 ~/ai-office-agents/docs/ 에서 볼 수 있습니다.

---

## 🌐 환경 요구사항

### 본인 (이미 설치된 환경)
- ✅ macOS 11+ (현재 사용 중)
- ✅ Node.js 20
- ✅ OpenClaw 2026.5+
- ✅ Firebase 프로젝트 (desk-rpg-a2edb)
- ✅ ~/Applications/AI Office 시작.app

### 받는 사람 (install.command 자동 설치)
- 필요: macOS 11+ (확인하라고 안내)
- 자동: Homebrew, Node.js, git, OpenClaw
- 본인 입력 필요: API 키, Firebase 프로젝트, 봇 토큰
- 권장: 외부 모니터/충전기 (뚜껑 닫고 24/7 운영하려면)

---

## 📞 흐름 정리 — 평소 사용은 이렇게

### 일상 흐름 (본인)
1. **아침**: 맥북 켜기 → launchd 가 자동으로 AI Office 가동 (또는 .app 더블클릭)
2. **이동**: 맥북 뚜껑 닫음 (sleep 됨 — caffeinate 가 idle 방지)
3. **외출 중**: 텔레그램에서 `/research 2026 편의점 PB 트렌드` 보냄
4. **카페**: 1분 후 텔레그램에 리서치 결과 도착
5. **저녁**: 슬랙에 `/report Q3 매출 분석` 보냄
6. **밤**: 2분 후 슬랙에 통합 보고서 도착
7. **자기 전**: 맥북 그대로 두기 (전기료 한 달 25원 ~)

### 일상 흐름 (받은 사람)
1. install.command 1회 실행 → 15분 후 완료
2. .env.local 에 키 입력 → 5분
3. Firebase + 봇 설정 → 10분
4. 이후 본인과 동일하게 사용

---

## 🛠️ 자주 묻는 질문

**Q. 맥북 끄면 어떻게 되나요?**
A. 봇 응답 안 됨. sleep 은 OK (caffeinate 가 idle 방지), 완전 종료/재부팅 후 .app 다시 실행 필요. launchd 설치했으면 부팅 시 자동.

**Q. 외부에 IP 공개해야 하나요?**
A. 아니요. 텔레그램/슬랙/디스코드 봇은 **outbound** (맥북 → 서버) 방식이라 외부 접속 받지 않습니다. 방화벽도 그대로 OK.

**Q. 두 대의 맥에서 같은 봇을 쓰면?**
A. 한 대만 활성화 권장. 둘 다 켜놓으면 메시지를 중복 처리할 수 있음. Firestore 페르소나는 둘 다에서 읽기 OK.

**Q. .app 을 친구한테 그대로 복사 줘도 되나요?**
A. ❌ 동작 안 함. .app 안의 경로가 본인 맥북에 고정돼 있어서 (`/Users/heoujin/...`). 친구는 **install.command** 받아서 실행해야 본인 맥북에 맞는 .app 생성됨.

**Q. .app 아이콘 바꾸고 싶어요.**
A. Applications 의 .app 우클릭 → Get Info → 좌측 상단 아이콘 클릭 → 원하는 이미지 드래그.

**Q. 설치 후 업데이트하려면?**
A. `cd ~/ai-office-agents && git pull && bash scripts/mac-app/build-apps.sh` (의존성 바뀌면 `npm install` 도)

**Q. .app 가 동작 안 해요.**
A. `tail -50 ~/ai-office-agents/logs/deskrpg.log` 로 에러 확인. 흔한 원인:
- node 가 PATH 에 없음 → `which node` 확인 후 .app 내부 launcher 의 경로 수정
- 포트 충돌 → `lsof -ti :3000` 으로 다른 프로세스 죽이기
- OpenClaw 페어링 만료 → `openclaw devices list` 확인

---

## 🔗 더 깊이

- [PRD](PRD.md) — 무엇을 / 왜 만들었나
- [TRD](TRD.md) — 어떻게 동작하나
- [ERD](ERD.md) — 데이터 구조
- [TASKS](TASKS.md) — 단계별 작업 목록
- [REPLICATION-PROMPT](REPLICATION-PROMPT.md) — AI 어시스턴트에게 재현시키는 프롬프트
- [docs/platform-setup/](platform-setup/) — 봇/맥북 설정 가이드 4편
