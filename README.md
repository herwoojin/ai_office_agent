# 🏢 AI Office Agents

**3명의 AI 직원이 가상 사무실에서 일하는 멀티 에이전트 시스템**

텔레그램으로 업무를 지시하면, OpenAI(GPT), Claude, Gemini 3명의 AI 직원이 DeskRPG 가상 사무실에서 걸어다니며 일하고, 서로 미팅하고 논쟁한 뒤, 최종 보고서를 텔레그램 / 카카오톡 / 슬랙으로 전송합니다.

## 기술 스택

| 컴포넌트 | 기술 | 역할 |
|----------|------|------|
| DeskRPG | Next.js + Phaser.js + Socket.IO | 2D 가상 오피스 + NPC |
| Hermes Agent | Python + Gateway | 멀티모델 에이전트 + 메시징 |
| OpenClaw-Kakao | kmsg CLI | 카카오톡 메시지 연동 |

## 빠른 시작

```bash
# 1. 클론
git clone <this-repo>
cd ai-office-agents

# 2. 설치
bash scripts/setup.sh

# 3. API 키 입력
nano .env.local

# 4. 실행
bash scripts/start.sh
```

## AI 직원

| 이름 | 모델 | 역할 |
|------|------|------|
| 김대리 | OpenAI GPT-4o | 전략 기획, 데이터 분석 |
| 박과장 | Claude Sonnet | 보고서 작성, 품질 관리 |
| 이주임 | Gemini 2.0 Flash | 리서치, 트렌드 분석 |

## 자세한 가이드

[📖 docs/GUIDE.md](docs/GUIDE.md) 참조

## 라이선스

MIT
