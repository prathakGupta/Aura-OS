# app/models/schemas.py
from typing import List, Optional

from pydantic import BaseModel, Field

class UserProfile(BaseModel):
    user_id: str = Field(..., description="Unique ID from your frontend auth (e.g., Firebase/Clerk)")
    name: str
    guardian_number: str
    guardian_email: str

class TaskItem(BaseModel):
    title: str
    action: str
    order: int = Field(..., description="The index of the card on the drag-and-drop timeline")

class SessionSync(BaseModel):
    user_id: str
    initial_query: Optional[str] = None
    tasks: List[TaskItem] = Field(default_factory=list)
    worries: List[str] = Field(default_factory=list)
