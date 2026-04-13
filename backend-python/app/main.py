# app/main.py
import sys
# Monkey-patch pydantic.v1.typing for Python 3.12.4+ compatibility
import pydantic.v1.typing
_original_evaluate = pydantic.v1.typing.evaluate_forwardref
def _evaluate_patched(type_, globalns, localns):
    import typing
    try:
        return _original_evaluate(type_, globalns, localns)
    except TypeError:
        return typing.cast(typing.Any, type_)._evaluate(globalns, localns, recursive_guard=set())
pydantic.v1.typing.evaluate_forwardref = _evaluate_patched

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_audio import router as audio_router
from app.api.routes_tasks import router as tasks_router
from app.api.routes_triage import router as triage_router
from app.api.routes_rag import router as rag_router
from app.core.database import connect_to_mongo, close_mongo_connection
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title="AuraOS API",
    description="Backend for AuraOS Mental Health Engine",
    lifespan=lifespan,
)

cors_origins = list(dict.fromkeys([*settings.FRONTEND_ORIGINS, settings.FRONTEND_URL]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio_router, tags=["Audio"])
app.include_router(tasks_router, prefix="/api/v1/ai", tags=["LangChain Logic"])
app.include_router(triage_router, prefix="/api/v1/triage", tags=["Triage System"])
app.include_router(rag_router, prefix="/api/v1/rag", tags=["Clinical RAG"])


@app.get("/")
async def root():
    return {"message": "AuraOS Engine is online and ready."}


@app.get("/health")
async def health():
    return {"ok": True, "service": "aura-python-backend"}
