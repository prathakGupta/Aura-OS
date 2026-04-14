# Aura-OS Folder Structure

This structure focuses on the main project files and directories.
Large generated/vendor folders like `node_modules/` are omitted, and the ML audio dataset is collapsed for readability.

```text
Aura-OS/
├── README.md
├── package.json
├── package-lock.json
├── FOLDER_STRUCTURE.md
├── docs/
│   ├── API_CONTRACTS.md
│   ├── architecture-diagram.png
│   └── pitch-deck.pdf
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       ├── main.jsx
│       ├── components/
│       │   ├── ErrorBoundary.jsx
│       │   ├── MentalHealthIntake.jsx
│       │   ├── Onboarding.jsx
│       │   ├── PerceptionProbe.jsx
│       │   ├── aura-voice/
│       │   │   └── AuraVoice.jsx
│       │   ├── cognitive-forge/
│       │   │   └── CognitiveForge.jsx
│       │   ├── observer-portal/
│       │   │   ├── Dashboard.jsx
│       │   │   ├── TriageLog.jsx
│       │   │   └── VsiChart.jsx
│       │   └── task-shatter/
│       │       ├── BodyDouble.jsx
│       │       ├── SymptomInterruption.jsx
│       │       └── TaskShatter.jsx
│       ├── hooks/
│       │   ├── useAudioStream.js
│       │   ├── useFocusTimer.js
│       │   ├── useIdleDetection.js
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
├── backend-node/
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js
│   └── src/
│       ├── config/
│       │   └── db.js
│       ├── controllers/
│       │   ├── clinicalCtrl.js
│       │   ├── forgeCtrl.js
│       │   ├── shatterCtrl.js
│       │   └── stateCtrl.js
│       ├── middleware/
│       │   └── errorHandler.js
│       ├── models/
│       │   ├── AlertLog.js
│       │   ├── ClinicalReport.js
│       │   └── UserState.js
│       ├── routes/
│       │   ├── clinical.js
│       │   ├── forge.js
│       │   ├── shatter.js
│       │   └── state.js
│       └── services/
│           ├── email.js
│           ├── gemini.js
│           ├── langchain.js
│           ├── reportPdf.js
│           ├── triageEngine.js
│           └── twilio.js
└── backend-python/
    ├── Dockerfile
    ├── main.py
    ├── requirements.txt
    ├── _uvicorn_err.log
    ├── _uvicorn_out.log
    ├── app/
    │   ├── api/
    │   │   └── sockets.py
    │   └── core/
    │       ├── emotion_ai.py
    │       ├── generator.py
    │       └── transcriber.py
    ├── models/
    │   ├── aura_arousal_nn.pkl
    │   ├── aura_arousal_rf.pkl
    │   └── aura_scaler.pkl
    └── training/
        ├── train_model.py
        └── dataset/
            ├── calm/
            ├── high_arousal/
            └── sad/
```

## Omitted for readability

- `frontend/node_modules/`
- `backend-node/node_modules/`
- individual `.wav` files inside `backend-python/training/dataset/`
