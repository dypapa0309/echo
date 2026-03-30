# Echo - 아키텍처 설계 문서

## 1. 개요

**Echo**: 핵심 인재(High-Achievers)를 위한 온디바이스 AI 음성 메모 어플리케이션

**핵심 가치 제안**:
- 생각의 속도와 기록의 속도를 일치 (Zero-Friction Input)
- 보안 걱정 없는 온디바이스 AI 처리
- 행동으로 이어지는 자동 추출 및 통합

---

## 2. 아키텍처 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                    ECHO ARCHITECTURE                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐     ┌────────────────────────┐    │
│  │ Zero-Friction    │     │  On-Device AI Core     │    │
│  │ Input Layer      │────▶│  ┌──────────────────┐  │    │
│  │                  │     │  │ 1. Local STT     │  │    │
│  │ • Lock Screen    │     │  │ 2. NLP Pipeline  │  │    │
│  │ • Widget         │     │  │ 3. Action Item   │  │    │
│  │ • Background     │     │  │    Extraction    │  │    │
│  │ • Voice Trigger  │     │  └──────────────────┘  │    │
│  └──────────────────┘     └────────────────────────┘    │
│                                                           │
│                          │                               │
│                          ▼                               │
│          ┌────────────────────────────────┐            │
│          │ Context Mapping Engine         │            │
│          │ • GPS Location                 │            │
│          │ • Timestamp                    │            │
│          │ • Calendar Events              │            │
│          │ • People/Mentions              │            │
│          └────────────────────────────────┘            │
│                          │                               │
│                          ▼                               │
│          ┌────────────────────────────────┐            │
│          │  Data Storage & Indexing       │            │
│          │ • Local SQLite / MMKV          │            │
│          │ • Vector DB (Embeddings)       │            │
│          │ • Full-Text Search Index       │            │
│          └────────────────────────────────┘            │
│                          │                               │
│                          ▼                               │
│          ┌────────────────────────────────┐            │
│          │  Integration Layer             │            │
│          │ • Slack API                    │            │
│          │ • Google Calendar API          │            │
│          │ • Clipboard                    │            │
│          │ • Native To-Do Apps            │            │
│          └────────────────────────────────┘            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 핵심 모듈별 아키텍처

### 3.1 Zero-Friction Input Layer (초고속 입력 레이어)

**목표**: 앱을 켜지 않고도 즉시 녹음 시작

```typescript
// Input Methods Priority
1. Voice Activation (음성 트리거) - "에코, 메모"
2. Lock Screen Widget (잠금 화면 위젯) - 터치 1회
3. Quick Tile (빠른 설정) - 터치 1회
4. Wearable (워치/에어팟) - 더블 탭
5. Background Recording (백그라운드) - 지속 모니터링
```

**구현 방식**:
- iOS: Siri Shortcut + CallKit + Lock Screen Widget
- Android: App Shortcut + Broadcast Receiver + Quick Settings Tile

---

### 3.2 On-Device AI Core (온디바이스 AI 핵심)

#### 3.2.1 Local Speech-to-Text (STT)

```
Raw Audio Input (녹음)
        │
        ▼
┌───────────────────────┐
│ Speech Recognition    │
│ Engine                │
│ (Model: Whisper-Tiny  │
│  또는 Android STT)    │
└───────────────────────┘
        │
        ▼
    Text Output
    (전체 전사)
```

**기술 선택**:
- iOS: Speech Framework (Native) + Whisper.cpp
- Android: Google Speech Recognition (On-Device) + Whisper.cpp

#### 3.2.2 NLP Pipeline (자연어 처리)

```
Transcribed Text
        │
        ▼
┌─────────────────────────────┐
│ 1. Tokenization & Cleanup   │ (어절 분리, 정제)
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ 2. Named Entity Recognition │ (사람, 조직, 시간 추출)
│    (NER)                    │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ 3. Dependency Parsing       │ (문장 구조 분석)
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ 4. Action Item Extraction   │ (핵심 기능 ★)
│    (Rule-Based + ML)        │
└─────────────────────────────┘
        │
        ▼
   Structured Output
   (JSON)
```

#### 3.2.3 Action-Item Extraction (행동 항목 추출) ★ 핵심 기능

**목표**: 회의 전사본에서 "누가, 언제까지, 무엇을" 하기로 했는지 자동 추출

**아키텍처**:

```
Input: "이 부분은 다음 주까지 김 대리가 리서치해 주세요"

Step 1: Pattern Recognition (패턴 인식)
  ├─ Temporal Patterns: "다음 주까지" → Deadline
  ├─ Action Verbs: "리서치해" → Task Type
  ├─ Agent: "김 대리" → Assignee
  └─ Object: "이 부분" → Task Description

Step 2: Entity Resolution (개체 해석)
  ├─ "김 대리" → Look up in Contacts/Calendar
  ├─ "다음 주까지" → Convert to Date (e.g., 2026-04-03)
  └─ "리서치" → Classify Task Category

Step 3: Confidence Scoring (확신도 평가)
  └─ If confidence > 0.85 → Auto-create To-Do
     Else if 0.5-0.85 → Show Suggestion
     Else → Ignore

Output JSON:
{
  "action_items": [
    {
      "id": "uuid",
      "assignee": "김 대리",
      "assignee_contact": "+82-10-XXXX-XXXX",
      "task": "이 부분 리서치",
      "task_type": "RESEARCH",
      "deadline": "2026-04-03",
      "confidence": 0.92,
      "source_timestamp": "00:45:32",
      "source_text": "이 부분은 다음 주까지 김 대리가 리서치해 주세요",
      "links": {
        "calendar": "Meeting-0327-2pm",
        "slack_channel": "project-alpha"
      }
    }
  ]
}
```

**패턴 매칭 규칙 (Rule-Based)**:

```python
# 한국어 Action-Item 패턴 정의

ACTION_PATTERNS = {
    # Pattern: (regex, extractor_function)
    "explicit_assignment": (
        r'(.+?)(?:가|이)\s+(.+?)(?:해|하|리|라)(?:\s+주|$)',
        extract_explicit_task
    ),
    "deadline_first": (
        r'(\d+월\s+\d+일|다음\s+\S+|이번\s+\S+)(?:까지)\s+(.+?)(?:해|하|리|라)',
        extract_deadline_task
    ),
    "imperative": (
        r'(.+?)(?:해|하|리|라)\s+(?:주세요|줘|세요)',
        extract_imperative_task
    ),
    "commitment": (
        r'(?:제가|저희가|우리가)\s+(.+?)(?:해|하|드리|겠습니다)',
        extract_commitment
    ),
}

TEMPORAL_EXPRESSIONS = {
    "다음 주": lambda: add_days(today, 7),
    "이번 주 말": lambda: next_friday(),
    "내일": lambda: add_days(today, 1),
    "오늘": lambda: today,
    "이달 말": lambda: last_day_of_month(),
}

ACTION_VERBS = {
    "리서치": "RESEARCH",
    "검토": "REVIEW",
    "작성": "WRITE",
    "결재": "APPROVE",
    "연락": "CONTACT",
    "보고": "REPORT",
    "조사": "INVESTIGATE",
    "수정": "MODIFY",
}
```

**ML-기반 향상 (v2+)**:

```
BERT/ko 기반 Sequence Classification
- Input: 문장
- Output: [Action, Temporal, Agent, Object] 확률값

사용 모델:
- klue/bert-base: 한국어 NER + Classification
- 또는 경량 모델 (MobileBERT)
```

---

### 3.3 Context Mapping Engine (상황 매핑 엔진)

**녹음 시점의 메타데이터 자동 수집**:

```
Trigger: Recording Start
    │
    ├─ GPS: Get current location
    ├─ Time: Exact timestamp
    ├─ Calendar: Check active events
    ├─ People: Extract caller ID / nearby people (Bluetooth)
    └─ Device State: WiFi/Mobile, Battery, etc.

Output:
{
  "recording_session": {
    "id": "uuid",
    "timestamp": "2026-03-27T14:32:45Z",
    "duration": 3245,  // seconds
    "location": {
      "latitude": 37.4979,
      "longitude": 127.0276,
      "address": "강남구 테헤란로",
      "place_type": "office"
    },
    "calendar_event": {
      "title": "Project Alpha Review",
      "attendees": ["kim@company.com", "lee@company.com"],
      "room": "Conference Room B"
    },
    "people": {
      "primary_speaker": "kim@company.com",
      "detected_speakers": ["kim@company.com", "lee@company.com", "self"]
    },
    "device_context": {
      "audio_quality": "high",
      "noise_level": "moderate",
      "proximity": ["airpods_pro"]
    }
  }
}
```

---

### 3.4 Data Storage Architecture (데이터 저장 아키텍처)

```
Layer 1: Hot Data (최근 녹음)
    ├─ SQLite (meta data)
    └─ Audio File (encrypted)

Layer 2: Indexed Data (검색용)
    ├─ Vector Database (embeddings for similarity search)
    ├─ Full-text index (keyword search)
    └─ Tag index (category/person/project)

Layer 3: Cold Data (아카이브)
    └─ 30일 이상 old recordings (압축)

Encryption: AES-256 (all local data)
```

**Schema**:

```sql
-- 녹음 세션 메타데이터
CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  title TEXT,
  timestamp INTEGER,
  duration INTEGER,
  audio_path TEXT,
  transcript TEXT,
  summary TEXT,
  
  location_latitude REAL,
  location_longitude REAL,
  location_name TEXT,
  
  calendar_event_id TEXT,
  calendar_title TEXT,
  
  people_json TEXT,  -- JSON list of participants
  
  action_items_json TEXT,  -- Extracted action items
  
  confidence_score REAL,
  
  created_at INTEGER,
  updated_at INTEGER,
  
  FOREIGN KEY (calendar_event_id) REFERENCES calendar_events(id)
);

-- 행동 항목 테이블
CREATE TABLE action_items (
  id TEXT PRIMARY KEY,
  recording_id TEXT,
  assignee TEXT,
  assignee_contact TEXT,
  task_description TEXT,
  task_type TEXT,
  deadline INTEGER,
  confidence REAL,
  status TEXT DEFAULT 'PENDING',
  
  synced_to_calendar BOOLEAN DEFAULT 0,
  synced_to_slack BOOLEAN DEFAULT 0,
  synced_to_todo BOOLEAN DEFAULT 0,
  
  created_at INTEGER,
  
  FOREIGN KEY (recording_id) REFERENCES recordings(id)
);

-- 벡터 임베딩 (유사도 검색)
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  recording_id TEXT UNIQUE,
  vector BLOB,  -- 384-dim vector (sentence-transformers)
  
  FOREIGN KEY (recording_id) REFERENCES recordings(id)
);

-- 태그 및 관계
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  recording_id TEXT,
  tag_type TEXT,  -- 'PERSON', 'PROJECT', 'PRIORITY', 'CUSTOM'
  tag_value TEXT,
  
  FOREIGN KEY (recording_id) REFERENCES recordings(id)
);
```

---

### 3.5 Integration Layer (통합 레이어)

#### 3.5.1 Slack Integration

```
Action Item Extraction
    │
    ▼
Formatted Message:
"📋 Meeting: Project Alpha Review (Mar 27, 2pm)
- 📌 김 대리가 이 부분 리서치 [by Next Wed]
- 📌 이과장이 예산안 재조정 [by Mar 30]

Confidence: 92%
🔗 Calendar | 🎙️ Full Recording"
    │
    ▼
→ Slack Channel Post
→ Add To-Do Thread
→ Set Reminders
```

#### 3.5.2 Google Calendar API Integration

```
Action Item {
  assignee: "kim@company.com",
  task: "Research this part",
  deadline: "2026-04-03"
}
    │
    ▼
Create Calendar Event:
{
  "summary": "[Echo] Research this part",
  "description": "From: Project Alpha Review\nSource: Echo Recording",
  "start": "2026-04-03T09:00:00",
  "end": "2026-04-03T17:00:00",
  "attendees": [{"email": "kim@company.com"}],
  "reminders": [
    {"method": "notification", "minutes": 1440},  // 1 day before
    {"method": "notification", "minutes": 60}      // 1 hour before
  ]
}
    │
    ▼
→ Send Invitation
→ Track RSVP Status
```

#### 3.5.3 To-Do App Integration

```
Supported Apps:
- Apple Reminders (iOS)
- Google Tasks (Android/All)
- Microsoft To Do
- Todoist API
- Notion API

API Flow:
1. User selects preferred To-Do app
2. Smart permission request
3. Auto-sync extracted action items
4. 2-way sync for completion status
```

---

## 4. MVP Implementation Roadmap

### Phase 1 (Weeks 1-3): Core Infrastructure

- [ ] Zero-friction input (Lock screen widget + Voice trigger)
- [ ] Local STT + Basic transcript storage
- [ ] Simple context mapping (GPS, time)
- [ ] Rule-based action item extraction (v1)

### Phase 2 (Weeks 4-6): AI Enhancement

- [ ] NLP pipeline (NER, Dependency parsing)
- [ ] Improved action item extraction (ML-based)
- [ ] Vector embeddings for similarity search
- [ ] Contextual search UI

### Phase 3 (Weeks 7-9): Integration

- [ ] Slack integration
- [ ] Google Calendar API
- [ ] To-Do app sync
- [ ] Clipboard auto-copy

### Phase 4 (Week 10+): Polish & Scale

- [ ] UI/UX refinement
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Analytics & feedback loop

---

## 5. 기술 스택 상세

### Frontend
- React Native (TypeScript)
- React Navigation
- Reanimated (smooth UI)
- FastImage (caching)

### AI/ML
- Whisper.cpp (Local STT)
- NLTK / Khaiii (한국어 NLP)
- sentence-transformers (embeddings)
- ONNX Runtime (model inference)

### Backend (Device)
- SQLite + MMKV (storage)
- GRPC (fast IPC)
- RxJava/Combine (reactive flows)

### APIs
- Google Calendar API
- Slack API
- Notion API
- Microsoft Graph (To Do)

### Testing
- Jest (unit tests)
- Detox (E2E)
- XCTest / Espresso (native)

---

## 6. 보안 고려사항

```
🔒 On-Device Processing Only
├─ All audio encr pted locally (AES-256)
├─ No cloud sync by default
├─ Optional E2E P2P sync (future)
└─ GDPR compliant (no external transmission)

🔐 Permissions Management
├─ Microphone (iOS/Android native)
├─ Contacts (for assignee resolution)
├─ Calendar (for meeting detection)
└─ Location (for context)

🛡️ Data Isolation
├─ App Sandbox (all OS levels)
├─ Encrypted preferences
└─ No third-party tracking
```

---

## 7. 성과 지표 (KPI)

- **Activation Speed**: 음성 트리거부터 녹음 시작까지 < 2초
- **Extraction Accuracy**: 행동 항목 추출 정확률 > 85%
- **latency**: 녹음 종료 후 요약까지 < 10초 (온디바이스)
- **User Retention**: 7일 유지율 > 60%
- **Action Item Follow-rate**: 추출된 항목의 70% 이상 완료

---

## 8. 다음 미션: Action-Item Extractor 상세 구현

```python
# Core Algorithm Pseudocode

class ActionItemExtractor:
    def __init__(self):
        self.patterns = LOAD_ACTION_PATTERNS()
        self.nlp = LOAD_KO_NLP_MODEL()
        self.contacts_db = LOAD_CONTACTS()
    
    def extract(self, transcript):
        sentences = self.nlp.tokenize_sentences(transcript)
        action_items = []
        
        for sentence in sentences:
            # Step 1: Pattern matching
            matches = self.find_action_patterns(sentence)
            
            if not matches:
                # Step 2: NLU fallback
                intent = self.classify_intent(sentence)
                if intent.score > 0.7:
                    matches = [self._convert_intent_to_match(intent)]
            
            # Step 3: Entity extraction & linking
            for match in matches:
                action_item = {
                    "assignee": self.resolve_entity(match["assignee"]),
                    "task": match["task"],
                    "deadline": self.parse_deadline(match["deadline"]),
                    "confidence": match["confidence"],
                    "source_text": sentence
                }
                
                # Step 4: Validation
                if self.validate_action_item(action_item):
                    action_items.append(action_item)
        
        return action_items
```

이 아키텍처를 기반으로 코드 구현을 진행하시겠습니까?
