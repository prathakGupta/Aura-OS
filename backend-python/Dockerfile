# ──────────────────────────────────────────────────────────
# AuraOS Python Backend
# FastAPI + Whisper + librosa + Groq + ChromaDB RAG
# ──────────────────────────────────────────────────────────

FROM python:3.12-slim

# System dependencies for librosa, soundfile, and audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies
COPY backend-python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY backend-python/ .

# Expose the API + WebSocket port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import httpx; r=httpx.get('http://localhost:8000/health'); exit(0 if r.status_code==200 else 1)" || exit 1

# Start the FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
