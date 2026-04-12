# app/api/routes_triage.py
import os
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.services.llm_langchain import generate_clinical_summary
from app.services.pdf_generator import create_clinical_pdf
from app.services.notification import send_whatsapp_alert, send_email_with_pdf

router = APIRouter()

# Schema representing the data sent from the React frontend
class SessionData(BaseModel):
    user_name: str
    guardian_number: str # e.g., "+919876543210"
    guardian_email: str
    initial_query: str
    tasks: Optional[List[dict]] = []
    worries: Optional[List[str]] = []

def process_triage_background(data: SessionData):
    """Background task to compile summary, create PDF, and notify parents."""
    session_dict = data.model_dump()
    
    # 1. Generate AI Summary using Groq
    ai_summary = generate_clinical_summary(str(session_dict))
    
    # 2. Generate PDF
    pdf_path = create_clinical_pdf(data.user_name, session_dict, ai_summary)
    
    # 3. Send WhatsApp Alert
    wa_message = (f"🚨 AuraOS Alert: {data.user_name} just utilized the anxiety toolkit.\n\n"
                  f"AI Summary: {ai_summary}\n\n"
                  f"Please check your email for the full clinical report.")
    send_whatsapp_alert(data.guardian_number, wa_message)
    
    # 4. Send Email with PDF attachment
    email_subject = f"AuraOS Clinical Triage Report for {data.user_name}"
    email_body = f"Please find attached the clinical session report for {data.user_name}.\n\nSummary:\n{ai_summary}"
    send_email_with_pdf(data.guardian_email, email_subject, email_body, pdf_path)
    
    # Optional: Clean up the temp PDF to save server space
    if os.path.exists(pdf_path):
        os.remove(pdf_path)

@router.post("/trigger-triage")
async def api_trigger_triage(data: SessionData, background_tasks: BackgroundTasks):
    try:
        # Add the heavy lifting to the background task queue
        background_tasks.add_task(process_triage_background, data)
        
        # Immediately return success to the frontend so the UI doesn't freeze
        return {"success": True, "message": "Triage protocol initiated in the background."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))