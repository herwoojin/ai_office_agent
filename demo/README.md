# 🎥 AI Office Agents — 데모 패키지

이 폴더에 데모 영상, 스크린샷, 그리고 모든 설명서가 다 들어 있습니다.

## 📂 파일 목록

| 파일 | 내용 |
|---|---|
| **[DEMO-GUIDE.md](DEMO-GUIDE.md)** | 🥇 **초보자용 사용 설명서** — 스크린샷 포함, 처음부터 끝까지 |
| **[VIDEO-SCRIPT.md](VIDEO-SCRIPT.md)** | 영상 자막/보이스오버 스크립트 + ffmpeg 자막 합성 가이드 |
| [video/ai-office-demo.mp4](video/ai-office-demo.mp4) | 자동 녹화 데모 영상 (1440×900, ~2분, 5MB) |
| [video/ai-office-demo.webm](video/ai-office-demo.webm) | 같은 영상 webm 포맷 (원본) |
| [screenshots/](screenshots/) | 8개 단계별 스크린샷 (PNG) |
| [record-demo.js](record-demo.js) | Playwright 자동 녹화 스크립트 (재실행 가능) |

## 🎯 어떻게 시작하나요?

### 처음이라면:
1. **[DEMO-GUIDE.md](DEMO-GUIDE.md) 를 먼저 읽으세요** — 스크린샷과 함께 처음부터 따라할 수 있습니다.
2. 같은 폴더의 [video/ai-office-demo.mp4](video/ai-office-demo.mp4) 영상을 옆에 띄워두면 더 빠릅니다.
3. [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md) 는 영상에 자막을 입히고 싶을 때만 보세요.

### 영상을 다시 찍고 싶다면:
```bash
cd /Users/heoujin/ai-office-agents
rm -rf demo/screenshots demo/video
node demo/record-demo.js
```
약 2분 안에 새 스크린샷 8장 + 영상이 생성됩니다.

### 영상에 자막을 입히고 싶다면:
[VIDEO-SCRIPT.md](VIDEO-SCRIPT.md) 의 "자막을 영상에 입히려면" 섹션을 참고하세요. `ffmpeg` 한 줄로 됩니다.

## 🛠️ 영상 생성 방식

Playwright (헤드리스 Chromium) 으로:
1. JWT 쿠키를 주입해 자동 로그인
2. 채널 → 게임 페이지 이동
3. HTTP `/office/task`, `/office/meeting` 트리거 발사
4. 각 시점마다 PNG 캡쳐 + 동영상 녹화
5. ffmpeg 로 webm → mp4 변환

모든 게 자동이라, 데모를 변경하고 싶으면 [record-demo.js](record-demo.js) 안의 시나리오 텍스트만 바꿔서 재실행하면 됩니다.
