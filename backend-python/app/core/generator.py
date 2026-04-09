# backend-python/app/core/generator.py
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

try:
    client = Groq(api_key=GROQ_API_KEY)
except Exception:
    client = None

def generate_insight(transcribed_text: str, emotion_label: str) -> str:
    if not client or len(transcribed_text) < 3: return ""

    prompt = f"""
    User said: "{transcribed_text}"
    Vocal analysis: {emotion_label}.
    In ONE short sentence, what is their core cognitive blocker?
    """
    try:
        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a clinical psychology AI backend. Be brief."},
                {"role": "user", "content": prompt}
            ],
            model="llama3-8b-8192",
            max_tokens=50,
        )
        return chat.choices[0].message.content.strip()
    except Exception:
        return ""