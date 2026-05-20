# Product Requirements Document (PRD) — AI Office Agents

## 1. Overview

**제품명**: AI Office Agents
**한 줄 요약**: 3명의 AI 직원이 가상 사무실에서 일하고 회의하며, 외부 메신저(텔레그램/슬랙/디스코드)에서 업무를 받아 처리하는 디지털 트윈 시스템

**버전**: 1.0
**최종 갱신**: 2026-05

---

## 2. Problem Statement

### 사용자가 겪는 문제
- 개인 1인 기업/연구자가 LLM 여러 개를 활용한 업무 처리를 원하지만, 각 LLM 의 강점이 다름
- 한 번에 한 모델만 부르는 일반 챗봇 UX 는 "팀 협업" 느낌이 없음
- 외부에서 (이동 중, 다른 PC에서) 내 LLM 환경에 명령을 보내기 어려움

### 우리의 가설
- OpenAI(분석) + Anthropic(문서) + Google(리서치) 세 모델을 **페르소나** 화하면 협업 결과물 품질↑
- **2D 시각화** 가 있으면 작업 진행 상태가 직관적으로 보임
- **메신저 봇** 으로 어디서든 명령 → 맥북이 처리 → 응답

---

## 3. Personas

### P1. 1인 기획자 (Primary)
- 30대 PM/기획자, 노트북 1대
- 보고서 / 리서치 / 회의 결론 도출 자주 필요
- Notion/Slack 사용 중. 텔레그램은 개인용
- 기술적이지만 풀스택 개발자는 아님 → "더블클릭으로 켜지는" UX 중요

### P2. 개발자/연구자 (Secondary)
- LLM API 직접 호출 경험 있음
- 페르소나/프롬프트 직접 튜닝하고 싶음
- 자기 키 (OpenAI/Anthropic/Google) 보유
- CLI / Git 익숙

### P3. 팀 구성원 (Tertiary)
- P1/P2 가 셋업한 환경에 메시지로만 접근
- 슬랙 채널에서 명령 보내고 결과 받음

---

## 4. Goals & Non-Goals

### Goals
- ✅ 3개 LLM 모델을 **각자 다른 페르소나** 로 동시 운용
- ✅ **외부 메신저** (텔레그램/슬랙/디스코드) 셋 중 어느 채널에서도 동일 명령 동작
- ✅ **4가지 작업 모드** (working / meeting / research / report) 마다 모델별 최적 프롬프트
- ✅ **24/7 운영** (맥북 sleep 모드에서도)
- ✅ **더블클릭 실행** (.app 번들로 IDE 의존성 제거)
- ✅ Firebase Firestore 페르소나/프롬프트 클라우드 동기화

### Non-Goals
- ❌ 모바일 네이티브 앱 (메신저 봇으로 대체)
- ❌ 멀티 테넌트 SaaS (자기 맥북에서만 동작)
- ❌ 무료 사용 (LLM API 키 본인 부담)
- ❌ Windows / Linux 지원 (macOS 전용)

---

## 5. Key Features

| ID | 기능 | 우선순위 |
|---|---|---|
| F1 | 3명 NPC가 사무실 맵에서 자율 산책 (디지털 트윈) | P0 |
| F2 | 외부 메신저 명령 → 4가지 모드 트리거 | P0 |
| F3 | LLM 모델 NPC별 매핑 + 페르소나/프롬프트 편집 UI | P0 |
| F4 | Firebase Google 로그인 | P0 |
| F5 | macOS 24/7 운영 (launchd + caffeinate) | P0 |
| F6 | .app 더블클릭 실행 + 친절한 팝업 | P1 |
| F7 | 다른 사람도 install.command 한 번에 설치 | P1 |
| F8 | Firestore 프롬프트 동기화 (멀티 디바이스) | P1 |
| F9 | 자동 데모 영상 + 스크린샷 생성 | P2 |
| F10 | 카카오톡 연동 (macOS 전용 kmsg) | P2 |

---

## 6. User Stories

```
US-1: 1인 기획자가 메시지 한 줄로 회의 결과 받기
  As 1인 기획자, I want to /meeting 주제 명령을 보내면,
  3명의 AI 직원이 토론한 결과를 텍스트로 받고 싶다.
  
  AC:
  - 메신저에 한 줄 명령 입력 → 60-90초 후 결과 도착
  - 결과는 각 NPC 의견 + 합의 결론 포함
  - 동시에 브라우저에서 NPC 가 회의실로 모이는 모습 시각 확인 가능

US-2: 개발자가 NPC 페르소나 커스터마이즈
  As 개발자, I want to 김대리의 'meeting' 모드 프롬프트를 수정,
  내가 원하는 방식으로 회의에 참여하게 하고 싶다.
  
  AC:
  - /settings/llm 페이지 → 3단계 → 김대리 → 회의 탭 → 텍스트 편집 → 저장
  - Firestore 동기화 시 다른 디바이스에도 즉시 반영
  - 다음 회의부터 새 프롬프트 적용

US-3: 외출 중 텔레그램으로 보고서 요청
  As 1인 기획자, I want to 카페에서 텔레그램으로
  /report Q3 매출 분석 보내면, 맥북이 처리하고 결과를 텔레그램으로 받고 싶다.
  
  AC:
  - 맥북은 sleep 모드 OK (idle 만 방지)
  - 텔레그램 → 봇 → 맥북 → LLM 호출 → 결과 → 텔레그램
  - 약 2분 안에 완료
```

---

## 7. Success Metrics

| 지표 | 목표 |
|---|---|
| 설치 시간 (install.command 더블클릭부터 첫 실행까지) | ≤ 15분 |
| 회의 명령 → 결과 도착 시간 | ≤ 90초 |
| 보고서 명령 → 결과 도착 시간 | ≤ 150초 |
| 평균 idle 전력 소비 | ≤ 7W (M1/M2 기준) |
| 24시간 가동 시 메모리 사용 | ≤ 2GB |

---

## 8. Risks & Mitigations

| 리스크 | 대응 |
|---|---|
| OpenClaw CLI 호출 25초/턴 → 회의 90초 | 병렬 호출 (research/report), 사용자에게 시간 안내 |
| LLM 사용량 폭발로 과금 | TELEGRAM_ALLOWED_USERS 필수, 봇 ACL |
| 토큰 .env.local 유출 | gitignore + 푸시 보호 + .env.example만 커밋 |
| 맥북 sleep 으로 메시지 누락 | caffeinate -i + Wake for network access |
| Antigravity IDE 의존성 | .app 번들로 IDE 없이도 실행 |

---

## 9. Out of Scope (현재 버전)

- 모바일 푸시 알림 (메신저가 대신함)
- 음성 입출력 (TTS/STT)
- 실시간 화상 회의 (현재는 텍스트만)
- 다국어 응답 (현재 한국어 기본)
- 결제/구독 (자기 키 모델)

## 10. References

- [README](../README.md), [USAGE](../USAGE.md), [TASK](../TASK.md)
- [TRD](TRD.md), [ERD](ERD.md), [TASKS](TASKS.md)
