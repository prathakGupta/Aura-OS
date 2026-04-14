# Aura-OS Project Structure

This document provides an overview of the file structure and the primary functions of each component in the Aura-OS repository.

## Root Directory
- `docker-compose.yml`: Orchestrates the multi-container environment (Frontend, Node.js Backend, Python Backend, MongoDB, and ChromaDB).
- `package.json`: Defines project dependencies and global scripts.
- `README.md`: Main documentation for setup, architecture, and project mission.
- `.gitignore`: Specially configured to exclude environment variables, dependencies (`node_modules`), and large model artifacts.

---

## 🛠️ `backend-node/` (Service Orchestration)
The primary API layer for user management, state persistence, and clinical workflow orchestration.

- `server.js`: Entry point for the Express server; handles middleware, security, and database connections.
- **`src/controllers/`**: Core request handlers.
  - `clinicalCtrl.js`: Manages panic triggers, guardian alerts, dashboard metrics, and clinical PDF generation.
  - `forgeCtrl.js`: Logic for the "Cognitive Forge" (worry-offloading) sessions.
  - `shatterCtrl.js`: Handles "Task Shattering" logic for decomposing overwhelming objectives.
  - `stateCtrl.js`: General user state and session telemetry persistence.
- **`src/services/`**: Integration and business logic layer.
  - `langchain.js`: Manages clinical AI prompts and structured response parsing via LangChain.
  - `gemini.js`: Direct interface with Google Gemini AI for advanced reasoning.
  - `reportPdf.js`: Engine for generating high-fidelity clinical reports and recovery protocols in PDF format.
  - `twilio.js`: Dispatches SMS and WhatsApp notifications to guardians during high-arousal events.
  - `email.js`: Sends weekly/automated clinical updates to designated care providers.
  - `triageEngine.js`: Analyzes telemetry patterns to determine burnout risk levels.
- **`src/models/`**: MongoDB/Mongoose schemas for `UserState`, `AlertLog`, and `ClinicalReport`.

---

## 🐍 `backend-python/` (AI & ML Engine)
Specialized backend for computationally intensive tasks like audio processing, emotion detection, and RAG.

- `app/main.py`: Entry point for the FastAPI server.
- **`app/services/`**: The "Brain" of Aura-OS.
  - `audio_engine.py`: Handles real-time audio streams, transcription, and noise suppression.
  - `voice_service.py`: Utilizes ML models to detect emotional valence and arousal from vocal telemetry.
  - `rag_service.py`: Implements Retrieval-Augmented Generation for clinical knowledge retrieval from vector stores.
  - `behavioral_scorer.py`: Calculates executive function and behavioral health scores.
  - `node_bridge.py`: Manages IPC and data synchronization with the Node.js backend.
- **`app/api/`**: API routes for AI classification, RAG queries, and audio processing tasks.
- **`training/`**: Scripts and Jupyter notebooks for training custom emotion classification models.
- **`models/`**: Storage for pre-trained model weights (e.g., Wav2Vec2, Random Forest classifiers).

---

## 💻 `frontend/` (User Experience)
A high-fidelity React application optimized for low-friction interactions and ADHD-friendly design.

- `src/App.jsx`: Main application controller and routing engine.
- `src/index.css`: Global design system including glassmorphism utilities and smooth-motion animations.
- **`src/components/`**: Atomic and molecular UI components.
  - `Regulators/`: High-fidelity somatic grounding exercises (breathing, brown noise).
  - `Forge/`: Interactive elements for the Cognitive Forge module.
  - `Shatter/`: Interface for breaking down and visualizing complex tasks.
- **`src/services/`**: API service layer for communicating with the Node.js and Python backends.
- **`src/store/`**: Global state management (Zustand) for real-time telemetry and user configurations.
- **`src/physics/`**: Specialized logic for procedural animations and physics-based UI transitions.

---

## 🌐 `landing/` (Landing Page)
The public-facing portal for Aura-OS.

- `index.html`: A standalone, highly animated landing page that introduces the "Digital Nervous System" concept.

---

## 📚 `docs/` (Documentation)
- `API_CONTRACTS.md`: Detailed definitions of internal and external API interfaces.
- `architecture-diagram.png`: Visual overview of the system's data flow.
- `structure.md`: This file.
