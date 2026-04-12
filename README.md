# AuraOS — Your Mental Safety Net

AuraOS shifts mental health technology from **passive tracking** to **active, real-time intervention**. When a user is in a panic attack or ADHD executive dysfunction spiral, they cannot navigate complex UIs or type structured input — so we built an app that catches them exactly where they are.

---

## The problem

Current mental health apps are overwhelmingly passive. They ask you to fill out forms, track symptoms, and read dashboards — precisely when you're least capable of doing any of that. There is no "digital safety net."

## Our solution

Three intervention modes, each targeting a different failure state:

| Mode | Trigger | Mechanism |
|---|---|---|
| **Aura Voice** | Racing thoughts, can't articulate | Voice AI that reads acoustic emotion, not just words |
| **Cognitive Forge** | Panic, overwhelmed by worries | Physics-based worry destruction — literally drag fears into fire |
| **Task Shatterer** | ADHD task paralysis, frozen | AI breaks goals into 2-minute micro-quests, shown one at a time |

---

## Architecture

```
aura-os/
├── frontend/         React + Vite · Matter.js · Zustand
├── backend-node/     Express · LangChain · Gemini API · MongoDB
├── backend-python/   FastAPI · Whisper · Groq · ElevenLabs  (Deepanshu)
└── docs/             API_CONTRACTS.md · architecture diagram
```

**Microservices rationale:** The Python backend runs a real-time ML audio pipeline (emotion recognition + Whisper STT). Keeping it separate from Node ensures a slow LLM inference call never blocks the physics canvas or task API. Each service is independently deployable.

---

## Features deep dive

### 1. Aura Voice — Conversational Emotion AI

The voice assistant adapts its **tone and response length** based on the acoustic character of your anxiety, not just your words.

- **Frontend:** Web Audio API captures mic → `AnalyserNode` drives a 48-bar frequency visualizer → `ScriptProcessorNode` chunks PCM audio → WebSocket to Python
- **Python (Deepanshu):** librosa/wav2vec extracts pitch/cadence → Whisper transcribes → Groq LLM generates persona-driven response → ElevenLabs TTS → base64 audio back to frontend
- **Emotion modes:** `calm` · `mild_anxiety` · `high_anxiety` — each triggers different UI state, glow colors, and grounding prompts

### 2. Cognitive Forge — Physics-Based Cognitive Offloading

Turn the abstract chaos of anxiety into physical objects you can destroy.

- **User:** Types a stream-of-consciousness worry dump (no structure required)
- **Gemini Flash:** Extracts discrete worries into `[{ worry, weight }]` JSON — `weight` (1–10) maps directly to block width in the physics world
- **Matter.js:** Blocks spawn above the canvas with random torque and fall under gravity. User drags them into a fireplace sensor zone at the bottom
- **On destroy:** Particle burst, DB update, worry marked `destroyed` in MongoDB

### 3. Task Shatterer — Executive Function Engine

Solves ADHD task paralysis by destroying monolithic goals.

- **User:** Types a scary task ("Build the MERN backend")
- **LangChain + Groq:** `withStructuredOutput(ZodSchema)` forces the LLM into validated JSON — not prompt parsing, actual tool-call schema enforcement
- **Frontend:** Flashcard UI — only the **first step** is shown. Clicking "Done ✓" fires `canvas-confetti` and advances to the next step. All quests done → full confetti celebration
- **Focus Anchor:** Brown noise loops via HTML5 Audio while a task is active (scientifically backed ADHD focus aid)
- **Body Double:** `document.visibilityState` polling — if user switches tabs for > 8 seconds, a fullscreen SVG avatar appears: *"Hey — we were in a focus block."*

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast HMR, minimal config |
| Physics | Matter.js | 2D rigid body, sensor zones, mouse constraints |
| State | Zustand | Lighter than Redux, perfect for hackathon pace |
| Backend AI orchestration | LangChain + Groq | `withStructuredOutput` = validated JSON guaranteed |
| Worry extraction | Google Gemini Flash | Long context + fast for stream-of-consciousness text |
| Database | MongoDB Atlas | Flexible schema for evolving worry/task models |
| Audio ML | FastAPI + Whisper + librosa | Low-latency Python pipeline, isolated from Node |
| TTS | ElevenLabs | Emotionally nuanced voice output |

---

## Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB Atlas account (free tier works)
- API keys: Gemini, Groq, ElevenLabs

### 1. Clone and install

```bash
git clone <repo-url> && cd aura-os

# Install root + all Node services in one command
npm install && npm run install:all
```

### 2. Configure environment

```bash
# backend-node
cp backend-node/.env.example backend-node/.env
# → Fill in GEMINI_API_KEY, GROQ_API_KEY, MONGO_URI

# backend-python
cp backend-python/.env.example backend-python/.env
# → Fill in GROQ_API_KEY, ELEVENLABS_KEY
```

### 3. Generate brown noise audio

```bash
node scripts/generate-brown-noise.mjs
# → Writes frontend/public/brown-noise.mp3
```

### 4. Run

```bash
# Start Node backend + frontend together (recommended)
npm run dev

# Or separately:
npm run dev:node      # backend-node on :5001
npm run dev:frontend  # frontend on :5173

# Python backend (Deepanshu's service)
cd backend-python && uvicorn app.main:app --reload --port 8000
```

### 5. Verify before demo

```bash
node scripts/smoke-test.mjs
# Runs all 12 API endpoints and prints PASS/FAIL table
```

Open `http://localhost:5173`

---

## API reference

See [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) for the full request/response contract for all endpoints — including the WebSocket protocol for Deepanshu's Python service.

---

## Team

| Name | Domain |
|---|---|
| Mayank | Frontend · backend-node · GenAI pipeline |
| Deepanshu | backend-python · Audio ML · Speech emotion |

---

## Impact

AuraOS is built for the **1 in 5 people** who experience anxiety disorders and the estimated **2.5–4% of adults** with ADHD. The core design principle: **meet the user where they are**, not where the app expects them to be.

When someone is in crisis, they cannot navigate. So we made navigation unnecessary.












































# AuraOS API Contracts
> **Source of truth** for the interface between backend-node (Mayank) ↔ frontend (Mayank) ↔ backend-python (Deepanshu).
> Last updated: Vihaan DTU 9.0 Hackathon

---

## Base URLs

| Service | Local URL | Owner |
|---|---|---|
| backend-node (Express) | `http://localhost:5001` | Mayank |
| backend-python (FastAPI) | `http://localhost:8000` | Deepanshu |
| frontend (Vite) | `http://localhost:5173` | Mayank |

---

## 1. Session Management (`/api/state`)

### `POST /api/state/init`
Initialize or resume a user session. Call this on app load.

**Request**
```json
{
  "userId": "uuid-string-or-omit-for-new-user"
}
```

**Response**
```json
{
  "success": true,
  "userId": "generated-or-provided-uuid",
  "sessionsCount": 3,
  "isReturning": true,
  "lastActive": "2024-01-15T10:30:00.000Z"
}
```

### `GET /api/state/:userId`
Get the full user state summary (for the dashboard / home screen).

**Response**
```json
{
  "success": true,
  "exists": true,
  "userId": "abc-123",
  "lastActive": "2024-01-15T10:30:00.000Z",
  "stats": {
    "worriesDestroyed": 12,
    "tasksCompleted": 4,
    "totalSessions": 7
  },
  "activeTask": {
    "id": "task-uuid",
    "originalTask": "Build the MERN backend",
    "progress": 37,
    "currentQuest": {
      "id": 3,
      "action": "Open VS Code and create a new file called server.js",
      "tip": "Just open it. That's all. One thing.",
      "duration_minutes": 2,
      "completed": false
    }
  }
}
```

### `DELETE /api/state/:userId`
Wipe all user data (demo reset button).

---

## 2. Cognitive Forge (`/api/forge`)

### `POST /api/forge/extract` ⭐ Core Feature 2 Endpoint
Sends messy worry text to Gemini, returns structured worry blocks for Matter.js.

**Request**
```json
{
  "text": "I'm so behind on my project and also my mom is sick and I forgot to pay rent again and I don't even know if I'm good enough for this job",
  "userId": "abc-123"
}
```

**Response**
```json
{
  "success": true,
  "count": 4,
  "worries": [
    {
      "id": 1,
      "uuid": "physics-body-uuid",
      "worry": "project deadline slipping",
      "weight": 8,
      "status": "active"
    },
    {
      "id": 2,
      "uuid": "physics-body-uuid-2",
      "worry": "mom's health",
      "weight": 9,
      "status": "active"
    },
    {
      "id": 3,
      "uuid": "physics-body-uuid-3",
      "worry": "missed rent payment",
      "weight": 6,
      "status": "active"
    },
    {
      "id": 4,
      "uuid": "physics-body-uuid-4",
      "worry": "job competence doubts",
      "weight": 7,
      "status": "active"
    }
  ]
}
```

> **Frontend contract**: `uuid` maps 1:1 to the Matter.js body label.
> `weight` (1-10) → body width (e.g. `width = 80 + weight * 12`).

### `POST /api/forge/destroy`
Called when user drags a worry block into the Fireplace sensor zone.

**Request**
```json
{
  "userId": "abc-123",
  "worryId": "physics-body-uuid"
}
```

**Response**
```json
{
  "success": true,
  "message": "Worry destroyed. Let it go.",
  "worryId": "physics-body-uuid"
}
```

### `POST /api/forge/vault`
Save a worry for later reflection instead of destroying it.

**Request**
```json
{
  "userId": "abc-123",
  "worryId": "physics-body-uuid",
  "worry": "project deadline slipping",
  "weight": 8
}
```

### `GET /api/forge/vault/:userId`
Retrieve all vaulted (saved) worries.

**Response**
```json
{
  "success": true,
  "count": 2,
  "vault": [
    {
      "id": "uuid",
      "worry": "project deadline slipping",
      "weight": 8,
      "status": "vaulted",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### `DELETE /api/forge/vault/:userId/:worryId`
Remove a specific worry from the vault.

---

## 3. Task Shatterer (`/api/shatter`)

### `POST /api/shatter/breakdown` ⭐ Core Feature 3 Endpoint
Sends a scary monolithic task to LangChain/Groq, returns ordered micro-quests.

**Request**
```json
{
  "task": "Build the complete MERN backend for AuraOS",
  "userId": "abc-123"
}
```

**Response**
```json
{
  "success": true,
  "taskId": "task-uuid",
  "originalTask": "Build the complete MERN backend for AuraOS",
  "totalQuests": 6,
  "firstQuest": {
    "id": 1,
    "action": "Open your terminal and type: mkdir aura-os && cd aura-os",
    "tip": "You're already doing it. Just one command.",
    "duration_minutes": 2,
    "completed": false
  },
  "microquests": [
    {
      "id": 1,
      "action": "Open your terminal and type: mkdir aura-os && cd aura-os",
      "tip": "You're already doing it. Just one command.",
      "duration_minutes": 2,
      "completed": false
    },
    {
      "id": 2,
      "action": "Type: npm init -y and press Enter",
      "tip": "One command. It'll do the rest for you.",
      "duration_minutes": 2,
      "completed": false
    }
  ]
}
```

> **Frontend contract**: On load, only display `firstQuest`.
> After clicking "Done ✓", call `/complete` to get `nextQuest`.

### `POST /api/shatter/complete`
Mark a micro-quest as done. Returns the next quest and progress.

**Request**
```json
{
  "userId": "abc-123",
  "taskId": "task-uuid",
  "questId": 1
}
```

**Response**
```json
{
  "success": true,
  "questId": 1,
  "taskComplete": false,
  "questsCompleted": 1,
  "totalQuests": 6,
  "progress": 17,
  "nextQuest": {
    "id": 2,
    "action": "Type: npm init -y and press Enter",
    "tip": "One command. It'll do the rest for you.",
    "duration_minutes": 2,
    "completed": false
  },
  "message": "Quest 1 done. 5 left."
}
```

> When `taskComplete: true` → frontend shows full confetti + dopamine animation.

### `POST /api/shatter/abandon`
Gracefully set aside the active task.

**Request**
```json
{
  "userId": "abc-123",
  "taskId": "task-uuid"
}
```

### `GET /api/shatter/active/:userId`
Check for an active task on page load (session resume).

**Response**
```json
{
  "success": true,
  "activeTask": { "...full task object..." },
  "currentQuest": { "...next incomplete quest..." }
}
```

### `GET /api/shatter/history/:userId`
Completed and abandoned task history.

---

## 4. Python Backend Contract (Deepanshu → Frontend)

> **Note**: This section documents Deepanshu's FastAPI endpoints for the frontend's `useAudioStream.js` hook.

### WebSocket `ws://localhost:8000/ws/audio`
Bidirectional audio stream for Feature 1 (Conversational Emotion AI).

**Frontend sends**: Raw `Float32Array` audio chunks via WebSocket binary frames.

**Frontend receives**: JSON messages
```json
{
  "type": "transcript",
  "text": "I'm feeling really overwhelmed right now"
}
```
```json
{
  "type": "response",
  "text": "I hear you. Let's take one breath together.",
  "emotion": "high_anxiety",
  "tts_audio": "<base64-encoded-audio>"
}
```
```json
{
  "type": "emotion_update",
  "emotion": "high_anxiety",
  "pitch_score": 0.82,
  "cadence_score": 0.91
}
```

---

## Error Response Format

All endpoints return this shape on error:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

| Status Code | Meaning |
|---|---|
| 400 | Bad request (missing/invalid input) |
| 404 | Resource not found |
| 409 | Conflict (e.g. quest already completed) |
| 500 | Server/AI error |

---

## Quick Test Commands (curl)

```bash
# Health check
curl http://localhost:5001/health

# Init session
curl -X POST http://localhost:5001/api/state/init \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-123"}'

# Extract worries (Feature 2)
curl -X POST http://localhost:5001/api/forge/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "I cant stop worrying about my exams and my relationship and also money", "userId": "test-user-123"}'

# Break down a task (Feature 3)
curl -X POST http://localhost:5001/api/shatter/breakdown \
  -H "Content-Type: application/json" \
  -d '{"task": "Study for my physics exam tomorrow", "userId": "test-user-123"}'
```