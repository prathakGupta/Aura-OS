# app/services/pdf_generator.py
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from datetime import datetime

def create_clinical_pdf(user_name: str, session_data: dict, ai_summary: str) -> str:
    """Generates a PDF report and returns the file path."""
    
    # Create a temp directory if it doesn't exist
    os.makedirs("temp_reports", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = f"temp_reports/AuraOS_Report_{user_name}_{timestamp}.pdf"
    
    doc = SimpleDocTemplate(file_path, pagesize=letter)
    styles = getSampleStyleSheet()
    Story = []
    
    # Title
    Story.append(Paragraph(f"AuraOS Clinical Triage Report", styles['Title']))
    Story.append(Spacer(1, 12))
    Story.append(Paragraph(f"Date/Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
    Story.append(Paragraph(f"User: {user_name}", styles['Normal']))
    Story.append(Spacer(1, 12))
    
    # AI Clinical Summary
    Story.append(Paragraph("AI Clinical Summary:", styles['Heading2']))
    Story.append(Paragraph(ai_summary, styles['Normal']))
    Story.append(Spacer(1, 12))
    
    # Session Details
    Story.append(Paragraph("Session Details:", styles['Heading2']))
    Story.append(Paragraph(f"<b>Initial Trigger/Query:</b> {session_data.get('initial_query', 'N/A')}", styles['Normal']))
    Story.append(Spacer(1, 12))
    
    # Shattered Tasks (If any)
    if 'tasks' in session_data and session_data['tasks']:
        Story.append(Paragraph("Shattered Tasks (In User's Order):", styles['Heading3']))
        for idx, task in enumerate(session_data['tasks'], 1):
            Story.append(Paragraph(f"{idx}. {task['title']} - {task['action']}", styles['Normal']))
        Story.append(Spacer(1, 12))
        
    # Worry Blocks Shattered (If any)
    if 'worries' in session_data and session_data['worries']:
        Story.append(Paragraph("Worry Blocks Shattered:", styles['Heading3']))
        for worry in session_data['worries']:
            Story.append(Paragraph(f"- {worry}", styles['Normal']))

    # Build PDF
    doc.build(Story)
    return file_path