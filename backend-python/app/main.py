# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes_tasks import router as tasks_router
from app.api.routes_triage import router as triage_router

app = FastAPI(title="AuraOS API", description="Backend for AuraOS Mental Health Engine")

# CORS Setup - Allows your React/Vite frontend to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace "*" with your settings.FRONTEND_URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(tasks_router, prefix="/api/v1/ai", tags=["LangChain Logic"])
app.include_router(triage_router, prefix="/api/v1/triage", tags=["Triage System"])

@app.get("/")
async def root():
    return {"message": "AuraOS Engine is online."}