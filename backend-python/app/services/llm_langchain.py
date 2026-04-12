# app/services/llm_langchain.py
from langchain_groq import ChatGroq
from langchain.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from app.core.config import settings

# Initialize the Groq LLM (Using LLaMA 3 8B for lightning-fast inference)
llm = ChatGroq(
    groq_api_key=settings.GROQ_API_KEY, 
    model_name="llama3-8b-8192", 
    temperature=0.6,
    max_tokens=500 # Keep responses short and fast for our specific use case
)

# --- 1. ADHD Task Shattering Pipeline ---
class MicroQuest(BaseModel):
    title: str = Field(description="A very short, 2-5 word title for the micro-task")
    action: str = Field(description="A simple, non-intimidating action step taking less than 2 minutes")

class TaskList(BaseModel):
    tasks: list[MicroQuest] = Field(description="List of shattered micro-quests")

task_parser = JsonOutputParser(pydantic_object=TaskList)

def shatter_task(large_task: str) -> dict:
    """Breaks down an overwhelming task into bite-sized micro-quests."""
    prompt = PromptTemplate(
        template="""You are an empathetic ADHD initiation coach. The user is experiencing 'Executive Freeze' 
        and cannot start the following task: '{large_task}'. 
        Break this task down into 3 to 5 extremely small, highly actionable, and non-intimidating micro-quests. 
        The first step should take less than 1 minute to complete to trigger a dopamine response.
        
        {format_instructions}""",
        input_variables=["large_task"],
        partial_variables={"format_instructions": task_parser.get_format_instructions()},
    )
    
    chain = prompt | llm | task_parser
    return chain.invoke({"large_task": large_task})

# --- 2. Cognitive Forge 'Phoenix Reframe' ---
def generate_reframe(worry_text: str) -> str:
    """Turns a shattered worry block into a positive affirmation."""
    prompt = PromptTemplate(
        template="""The user just physically shattered a block containing this worry: '{worry_text}'. 
        Provide a single, short, grounding, and highly empathetic positive affirmation (max 15 words) 
        that they can read as the 'dust' settles. Do not be overly toxic-positive; be real and calming.""",
        input_variables=["worry_text"]
    )
    
    chain = prompt | llm
    result = chain.invoke({"worry_text": worry_text})
    return result.content

# --- 3. Triage Report Summarization ---
def generate_clinical_summary(session_data: str) -> str:
    """Generates a professional summary for the parents/guardians."""
    prompt = PromptTemplate(
        template="""Analyze the following session data from a user who just experienced an anxiety spike: 
        {session_data}
        
        Write a brief, professional, and clinical 3-sentence summary for their parent/guardian. 
        Focus on what triggered them, what actions they took to calm down, and their current presumed state.""",
        input_variables=["session_data"]
    )
    
    chain = prompt | llm
    result = chain.invoke({"session_data": session_data})
    return result.content