# Aura-OS System Architecture & Structure

This document tracks the main project directories and files, providing an updated overview of the system map and the specific function of each file. Large vendor directories (`node_modules/`, `.venv/`), datasets (`crema-d/`), and model training checkpoints are omitted for clarity and conciseness.

## Directory Tree

```text
Aura-OS/
├── README.md
├── FOLDER_STRUCTURE.md
├── docker-compose.yml
├── package.json
├── package-lock.json
│
├── docs/
│   ├── API_CONTRACTS.md
│   ├── architecture-diagram.png
│   ├── pitch-deck.pdf
│   └── structure.md
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       ├── main.jsx
│       ├── components/
│       │   ├── ErrorBoundary.jsx
│       │   ├── MentalHealthIntake.jsx
│       │   ├── aura-voice/
│       │   │   └── AuraVoice.jsx
│       │   ├── clinical-rag/
│       │   │   └── ClinicalRecovery.jsx
│       │   ├── cognitive-forge/
│       │   │   └── CognitiveForge.jsx
│       │   ├── landing/
│       │   │   └── LandingPage.jsx
│       │   ├── observer-portal/
│       │   │   ├── Dashboard.jsx
│       │   │   ├── TriageLog.jsx
│       │   │   └── VsiChart.jsx
│       │   └── task-shatter/
│       │       ├── BodyDouble.jsx
│       │       └── TaskShatter.jsx
│       ├── hooks/
│       │   ├── useAudioStream.js
│       │   ├── useFocusTimer.js
│       │   ├── usePhysics.js
│       │   └── useTelemetry.js
│       ├── physics/
│       │   ├── engine.js
│       │   ├── entities.js
│       │   └── interactions.js
│       ├── services/
│       │   ├── api.js
│       │   └── portalApi.js
│       └── store/
│           └── useStore.js
│
├── backend-node/
│   ├── package.json
│   ├── server.js
│   └── src/
│       ├── clinical_knowledge/
│       │   ├── adhd_rules.txt
│       │   └── anxiety_rules.txt
│       ├── config/
│       │   └── db.js
│       ├── controllers/
│       │   ├── clinicalCtrl.js
│       │   ├── forgeCtrl.js
│       │   └── stateCtrl.js
│       ├── middleware/
│       │   └── errorHandler.js
│       ├── models/
│       │   ├── AlertLog.js
│       │   ├── ClinicalReport.js
│       │   └── UserState.js
│       ├── routes/
│       │   ├── clinical.js
│       │   └── forge.js
│       └── services/
│           ├── gemini.js
│           ├── langchain.js
│           ├── reportPdf.js
│           └── triageEngine.js
│
└── backend-python/
    ├── requirements.txt
    ├── app/
    │   ├── main.py
    │   ├── api/
    │   │   ├── routes_ai.py
    │   │   ├── routes_audio.py
    │   │   └── routes_rag.py
    │   ├── core/
    │   │   ├── config.py
    │   │   └── database.py
    │   └── services/
    │       ├── audio_engine.py
    │       ├── behavioral_scorer.py
    │       ├── rag_service.py
    │       └── voice_service.py
    ├── clinical_knowledge/
    │   └── condition_protocols.txt
    ├── models/
    │   ├── stress_mlp.pkl
    │   ├── aura_arousal_rf.pkl
    │   └── wav2vec2_emotion.pt
    └── training/
        ├── train_ensemble.py
        └── train_wav2vec2.py
```

## Functional Overview

### Root
- **`README.md`**: Main documentation providing an overview of Aura-OS, installation, and deployment instructions.
- **`docker-compose.yml`**: Deployment configuration to stand up the Node and Python backends simultaneously.
- **`package.json`**: NPM configurations for managing global scripts or monorepo tools.

### `docs/`
- Documentation suite covering structural knowledge and diagrams.
- **`API_CONTRACTS.md`**: Specification of API request/response structures between frontend and both backends.
- **`structure.md`**: This manifest detailing the architecture.

### `frontend/`
A Vite and React-based interface providing high-fidelity visual interactions for users. Features global physics capabilities and telemetry tracking.
- **`src/App.jsx`**: Main application router and root layout.
- **`src/components/`**: Feature-grouped UI components:
  - **`aura-voice/`**: UI logic handling voice interactions with the emotional engine.
  - **`clinical-rag/`**: UI components presenting dynamically synthesized scientific protocols.
  - **`cognitive-forge/`**: Task breakdown layouts.
  - **`observer-portal/`**: Clinician dashboard components, rendering VSI metrics and telemetry.
- **`src/hooks/`**: Custom hooks bridging features:
  - **`useTelemetry.js`**: Streams user telemetry data to external states.
  - **`useAudioStream.js`**: Handles microphone buffer routing to the backend.
- **`src/physics/`**: Custom, performance-oriented physics engine driving glass UI logic and animations.
- **`src/services/api.js`**: API client bridging the UI with `backend-node` and `backend-python`.
- **`src/store/useStore.js`**: Generic state management container.

### `backend-node/`
The lightweight gateway infrastructure serving as an orchestration layer. Usually acts as an intermediary, routing tasks that do not require heavy ML inference.
- **`src/server.js`**: Express boilerplate and server initialization.
- **`src/config/db.js`**: Connection configuration for the primary MongoDB cluster.
- **`src/controllers/`** & **`src/routes/`**: Handle HTTP endpoints for the Clinical protocol generators and routine data logging.
- **`src/models/`**: Mongoose schemas tracking `UserState` dynamically and recording comprehensive `ClinicalReport` logic.
- **`src/services/`**:
  - **`reportPdf.js`**: Generates customized professional reports for export.
  - **`langchain.js` / `gemini.js`**: Bridges communication to generic LLM logic for standardized non-RAG text queries.

### `backend-python/`
The High-Performance API backend, written in FastAPI, executing mission-critical ML processes, ML ensemble validation, and deep retrieval pipelines.
- **`app/main.py`**: The FastAPI application entrypoint.
- **`app/api/`**: Route definitions delegating AI payloads to core services.
- **`app/services/`**: Core engines:
  - **`audio_engine.py` / `voice_service.py`**: Pushes audio chunks through the deep-learning array (`wav2vec2`) to extract sophisticated arousal/stress telemetries.
  - **`rag_service.py`**: Processes vector-store interactions against ChromaDB to build grounded RAG models from clinical rules.
  - **`behavioral_scorer.py`**: Correlates inputs across the ML ensemble models to emit a unified state score.
- **`models/`**: Static serialized binaries of trained models (Random Forest, MLP, Scikit-learn scalers, and PyTorch deep-learning weights) enabling rapid startup without retraining.
- **`training/`**: Data ingestion, normalization scripts (`build_dataset.py`, `extract_features.py`) and training orchestration workflows.
- **`clinical_knowledge/`**: The primary corpus of neurochemistry facts used as the grounding context for RAG processing.
