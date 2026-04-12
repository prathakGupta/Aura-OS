# app/api/routes_tasks.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.llm_langchain import shatter_task, generate_reframe

router = APIRouter()

# Schemas for incoming requests
class TaskRequest(BaseModel):
    task_description: str

class WorryRequest(BaseModel):
    worry_text: str

@router.post("/shatter-task")
async def api_shatter_task(request: TaskRequest):
    try:
        result = shatter_task(request.task_description)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/phoenix-reframe")
async def api_phoenix_reframe(request: WorryRequest):
    try:
        reframe = generate_reframe(request.worry_text)
        return {"success": True, "reframe": reframe}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))