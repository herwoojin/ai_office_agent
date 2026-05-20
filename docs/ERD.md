# Entity Relationship Diagram (ERD) — AI Office Agents

## 1. 전체 개요

데이터는 3곳에 분산:

| 저장소 | 주 데이터 |
|---|---|
| **SQLite (DeskRPG)** | users, characters, channels, npcs, messages, meeting_minutes |
| **Firestore (선택)** | npc-prompts (페르소나/모드 프롬프트) |
| **OpenClaw config + files** | agents 설정, IDENTITY.md / SOUL.md / AGENTS.md, auth-profiles |

---

## 2. SQLite (DeskRPG) — 핵심 테이블

```
┌─────────────────────────────┐
│ users                       │
│  PK id (text)               │
│     login_id (text, unique) │  "firebase:UID" or "local:loginId"
│     nickname (text)         │
│     password_hash (text)    │
│     system_role (text)      │  "user" | "system_admin"
│     created_at (text)       │
└─────────────────────────────┘
   │ 1
   │
   │ N
┌──▼──────────────────────────┐      ┌─────────────────────────────┐
│ characters                  │      │ groups                      │
│  PK id (text)               │      │  PK id (text)               │
│  FK user_id → users.id      │      │     name, slug, is_default  │
│     name (text)             │      │     owner_id, created_at    │
│     appearance (json)       │      └──┬──────────────────────────┘
│     created_at              │         │ 1
└─────────────────────────────┘         │
                                        │ N
                                  ┌─────▼───────────────────────┐
                                  │ group_members               │
                                  │  PK (group_id, user_id)     │
                                  │     role, joined_at         │
                                  └─────────────────────────────┘

┌─────────────────────────────┐
│ channels                    │
│  PK id (text)               │
│  FK group_id → groups.id    │
│  FK owner_id → users.id     │
│     name (text)             │
│     is_public (bool)        │
│  FK map_template_id         │
│     created_at              │
└──┬──────────────────────────┘
   │ 1
   │
   │ N
┌──▼──────────────────────────┐
│ channel_members             │       ┌─────────────────────────────┐
│  PK (channel_id, user_id)   │       │ channel_gateway_bindings    │
│     role                    │       │  PK channel_id              │
│     joined_at               │       │  FK gateway_id → ...        │
└─────────────────────────────┘       └─────────────────────────────┘

┌─────────────────────────────┐       ┌─────────────────────────────┐
│ npcs                        │       │ gateway_resources           │
│  PK id (text)               │       │  PK id (text)               │
│  FK channel_id → channels   │       │  FK owner_user_id → users   │
│     name (text)             │       │     display_name            │
│     appearance (json)       │       │     base_url (ws://...)     │
│     position_x, position_y  │       │     token_encrypted (AES)   │
│     direction               │       │     paired_device_id        │
│     openclaw_config (json)  │ ───┐  │     last_validation_status  │
│     created_at              │    │  │     created_at              │
└─────────────────────────────┘    │  └─────────────────────────────┘
                                   │
                                   └─→ openclaw_config = {
                                         agentId: "kim-daeri",
                                         sessionKeyPrefix: "ot-...",
                                         personaConfig: { identity, soul },
                                         locale: "ko"
                                       }

┌─────────────────────────────┐
│ chat_messages               │
│  PK id (text)               │
│  FK channel_id              │
│  FK author_user_id          │  (or NPC if from agent)
│     content (text)          │
│     created_at              │
└─────────────────────────────┘

┌─────────────────────────────┐
│ meeting_minutes             │
│  PK id (text)               │
│  FK channel_id              │
│     topic (text)            │
│     initiator_id            │
│     started_at, ended_at    │
│     turns_json (text)       │ [{ seq, displayName, content, ts }, ...]
│     summary_json (text)     │
└─────────────────────────────┘

┌─────────────────────────────┐
│ tasks                       │
│  PK id (text)               │
│  FK channel_id              │
│  FK npc_id (assignee)       │
│     title, summary          │
│     status ("pending" | "in_progress" | "complete" | "cancelled")
│     assigner_id             │
│     created_at, updated_at  │
└─────────────────────────────┘

┌─────────────────────────────┐
│ map_templates               │
│  PK id (text)               │
│     name (text)             │  "Small Office"
│     grid_w, grid_h          │  20, 15
│     spawn_col, spawn_row    │  10, 7
│     tiled_json (text)       │  Phaser 맵 데이터
│     created_at              │
└─────────────────────────────┘
```

---

## 3. Firestore (옵션) — 페르소나/프롬프트

```
/npc-prompts/{agentId}                    ← Document ID = "kim-daeri" / "park-gwajang" / "lee-juim"
  {
    base: string,                         ← 베이스 페르소나 (모든 모드 공통)
    modes: {
      working:  { systemPrompt: string }, ← 자기 자리에서 묵묵히 일하는 모드
      meeting:  { systemPrompt: string }, ← 회의 모드
      research: { systemPrompt: string }, ← 깊이 리서치 모드
      report:   { systemPrompt: string }  ← 보고서 작성 모드
    },
    createdAt: Timestamp,
    updatedAt: Timestamp,
    updatedBy: string                     ← Firebase UID (옵션)
  }

(향후 확장)
/users/{firebaseUid}
  { nickname, deskRpgUserId, systemRole, createdAt }

/users/{uid}/sessions/{sessionId}
  { device, startedAt, lastActive }

/users/{uid}/usage/{yyyy-mm}
  { tokensSpent, modelBreakdown, cost }
```

**보안 규칙**: [firebase/firestore.rules](../firebase/firestore.rules) 참고.

---

## 4. OpenClaw — 파일 시스템 기반

```
~/.openclaw/
├── openclaw.json                          ← gateway 설정 + agents 목록
│   {
│     "agents": {
│       "defaults": { "model": { "primary": "openai/gpt-5.5" } },
│       "entries": [
│         {
│           "id": "kim-daeri",
│           "model": { "primary": "openai/gpt-4o" },  ← 우리가 set
│           "workspace": "~/.openclaw/workspace-kim-daeri",
│           "identity": { "name": "kim-daeri" }
│         },
│         ...
│       ]
│     },
│     "gateway": { "auth": { "mode": "token", "token": "..." } }
│   }
│
├── agents/{agentId}/agent/
│   ├── IDENTITY.md                        ← 우리가 wire-agents.js / settings UI 로 저장
│   ├── SOUL.md
│   ├── AGENTS.md                          ← Task Management Protocol
│   ├── USER.md
│   └── auth-profiles.json                 ← per-provider 인증 (oauth/apikey)
│
├── credentials/auth-profiles/{hash}.json  ← Provider 별 API 키
│
└── devices/                               ← ed25519 페어링된 디바이스
```

---

## 5. 데이터 흐름 (예시: 회의)

```
1. User 가 /meeting "여름 신메뉴" 명령
   └─→ server-patch.js handleIncomingMessage

2. triggerMeeting() 호출
   ├─→ npcs 테이블 read (3명 NPC 좌표)
   ├─→ map_templates read (회의실 좌표 결정)
   └─→ Socket.IO: io.to(channel).emit("npc:position-sync", ...) → Phaser

3. 각 NPC 순차로 OpenClaw 호출
   ├─→ mode-prompts.getPrompt("kim-daeri", "meeting", {topic})
   │   ├─→ Firestore /npc-prompts/kim-daeri 캐시에서 base + modes.meeting 가져옴
   │   └─→ context block 추가 (topic, peers)
   ├─→ execFile("openclaw", ["agent", "--agent", "kim-daeri", "--message", fullPrompt, "--json"])
   │   ├─→ OpenClaw → ~/.openclaw/agents/kim-daeri/agent/IDENTITY.md 읽음
   │   ├─→ provider 인증 (~/.openclaw/credentials/...)
   │   └─→ openai API 호출 → finalAssistantRawText
   └─→ Socket.IO: io.to(channel).emit("npc:speech", {npcId, text}) → 풍선

4. 회의 종료 후 meeting_minutes 테이블에 INSERT
   (현재 미구현 — TODO)
```

---

## 6. Index / 쿼리 패턴

자주 사용되는 인덱스 (이미 [firestore.indexes.json](../firebase/firestore.indexes.json) 에 정의):

```sql
-- SQLite
CREATE INDEX idx_npcs_channel ON npcs(channel_id);
CREATE INDEX idx_chat_messages_channel_time ON chat_messages(channel_id, created_at DESC);
CREATE INDEX idx_tasks_channel_status ON tasks(channel_id, status);
CREATE INDEX idx_characters_user ON characters(user_id);

-- Firestore (composite)
channels: groupId ASC, createdAt DESC
tasks:    assigneeNpcId ASC, status ASC, createdAt DESC
```

---

## 7. 마이그레이션 전략 (SQLite → Firestore, 향후)

현재 핵심 도메인 데이터는 SQLite. Firestore 이관 시:
1. **유저** → Firebase Auth UID 가 PK
2. **캐릭터/채널/NPC** → 사용자 sub-collection
3. **메시지** → Firestore Realtime listener 로 socket.io 대체 가능
4. **회의록** → Firestore + Cloud Functions 트리거로 보고서 자동 생성

이관 스크립트는 [scripts/migrate-to-firestore.js](../scripts/) 에 추가 예정.
