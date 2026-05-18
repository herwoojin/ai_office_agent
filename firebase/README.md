# 🔥 Firebase Firestore / Storage Rules

이 폴더는 **desk-rpg-a2edb** 프로젝트의 Firestore + Cloud Storage 보안 규칙입니다.

## 📂 파일

| 파일 | 내용 |
|---|---|
| `firestore.rules` | Firestore DB 보안 규칙 (사용자/캐릭터/채널/NPC/메시지/회의/태스크 등) |
| `storage.rules` | Cloud Storage 규칙 (아바타, 채널 첨부파일, 보고서, 공개 자산) |
| `firestore.indexes.json` | 자주 쓰는 쿼리에 대한 composite index |
| `firebase.json` | Firebase CLI 설정 |
| `.firebaserc` | 프로젝트 alias (`desk-rpg-a2edb`) |

## 🚀 배포 방법

### 옵션 A — Firebase CLI (권장)

```bash
# 1. CLI 설치 (한 번만)
npm install -g firebase-tools

# 2. 로그인 (한 번만)
firebase login

# 3. 이 디렉터리로 이동
cd /Users/heoujin/ai-office-agents/firebase

# 4. 한 번에 배포
firebase deploy --only firestore:rules,firestore:indexes,storage

# 또는 개별 배포
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

### 옵션 B — Firebase 콘솔 (수동)

1. https://console.firebase.google.com/project/desk-rpg-a2edb/firestore/rules 접속
2. `firestore.rules` 내용 복사 → 붙여넣기 → **게시**
3. https://console.firebase.google.com/project/desk-rpg-a2edb/storage/rules 접속
4. `storage.rules` 내용 복사 → 붙여넣기 → **게시**

## 🔒 규칙 핵심 개념

### 1. 인증 필수
모든 collection 은 `isSignedIn()` 통과 필수. Google 로그인 이후 Firebase 가 발급한 `request.auth.uid` 기준.

### 2. 본인 소유 데이터만
`/users/{uid}`, `/characters/{id}`, `/gateways/{id}` 등은 `ownerId == request.auth.uid` 인 문서만 접근.

### 3. 채널 멤버십 기반 접근
`/channels/{id}/...` 의 NPC, 메시지, 회의록, 태스크 등은:
- **read**: 멤버(`/channels/{id}/members/{uid}` 존재) 면 OK
- **write**: 케이스별로 owner 또는 작성자만

### 4. immutable 필드 보호
`createdAt`, `ownerId`, `loginId`, `systemRole` 등은 update 시 변경 금지.

### 5. Admin SDK 는 항상 우회
서버 측에서 firebase-admin SDK 로 접근하면 rules 무관하게 통과. 백엔드 (Next.js API) 가 사용.

## 📊 데이터 모델 (예시)

```
/users/{uid}                              { nickname, systemRole, createdAt }
/characters/{characterId}                 { ownerId, name, appearance, createdAt }
/groups/{groupId}                         { ownerId, name, slug, isDefault }
  /members/{uid}                          { role, joinedAt }
/channels/{channelId}                     { ownerId, groupId, name, isPublic, mapTemplateId }
  /members/{uid}                          { role, joinedAt }
  /npcs/{npcId}                           { name, appearance, agentId, positionX/Y }
    /config/private                       { model, systemPrompt, personaConfig }  # 민감
  /messages/{messageId}                   { authorId, text, createdAt }
  /meetings/{meetingId}                   { initiatorId, topic, startedAt, endedAt }
    /turns/{turnId}                       { speakerId, text, timestamp }
  /tasks/{taskId}                         { assignerId, assigneeNpcId, status, title, summary }
  /reports/{reportId}                     { authorNpcId, title, body, deliveredTo[] }
/maps/{mapId}                             { name, gridW, gridH, tiledJson }
/gateways/{gatewayId}                     { ownerId, baseUrl, displayName }
/system/{docId}                           { ... }   # 공지/설정
```

## 🧪 로컬 에뮬레이터로 테스트

```bash
firebase emulators:start --only firestore,storage
# 콘솔: http://localhost:4000
# Firestore: http://localhost:8080
# Storage: http://localhost:9199
```

테스트 케이스 작성:
```bash
# package.json 에 추가
npm install -D @firebase/rules-unit-testing

# tests/rules.test.js 작성
firebase emulators:exec --only firestore "npm test"
```

## 🚨 주의사항

1. **`request.auth.uid` 는 Firebase UID** — DeskRPG 의 내부 user.id 와 다릅니다. 마이그레이션 시 mapping 필요 (`users/{firebaseUid}.deskRpgId` 같이).
2. **현재 DeskRPG 는 SQLite 사용 중** — 이 rules 는 향후 Firestore 로 이관/동기화할 때 사용.
3. **Custom Claims 미사용** — `systemRole` 을 Firestore 문서에서 읽음. 더 빠르게 하려면 Firebase Auth Custom Claims 로 옮길 수 있음.
4. **비용** — 각 rule 평가 시 `get()`/`exists()` 호출은 Firestore read 1회로 청구됨. 핫패스라면 캐싱 권장.

## 🔧 디버깅

규칙 위반 시 클라이언트는 `permission-denied` 에러 받음. 자세한 이유는:

- Firebase 콘솔 → Firestore → **규칙 → 사용량/오류**
- 또는 에뮬레이터 콘솔에서 실시간 로그

## 📚 참고

- [Firestore Security Rules 공식 가이드](https://firebase.google.com/docs/firestore/security/get-started)
- [Storage Security Rules 가이드](https://firebase.google.com/docs/storage/security)
- [rules-unit-testing 으로 자동화 테스트](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
