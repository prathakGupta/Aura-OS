# app/services/rag_service.py
# Clinical RAG (Retrieval-Augmented Generation) Knowledge Base service.
#
# Uses ChromaDB as a local vector store (no API key / no external service).
# Embeds curated clinical knowledge from Harvard Nutritional Psychiatry
# and Dr. Ratey's exercise neurochemistry research.
#
# Flow:
#   1. On startup → ingest_knowledge_base() loads .txt files, chunks them,
#      and stores embeddings in a local ChromaDB collection.
#   2. On request → query_clinical_rag() retrieves top-k relevant passages.
#   3. generate_recovery_protocol() combines RAG context + user profile
#      and sends to Groq LLM for a structured, grounded response.

from __future__ import annotations

import os
import glob
from pathlib import Path
from functools import lru_cache

from app.core.config import settings

# ── Graceful imports (system works without RAG deps installed) ───────────
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
except ImportError:
    chromadb = None
    ChromaSettings = None

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    RecursiveCharacterTextSplitter = None

try:
    from langchain.prompts import PromptTemplate
    from langchain_groq import ChatGroq
except ImportError:
    PromptTemplate = None
    ChatGroq = None


# ── Paths ───────────────────────────────────────────────────────────────
KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent.parent / "clinical_knowledge"
CHROMA_PERSIST_DIR = Path(__file__).resolve().parent.parent.parent / ".chroma_db"

# ── Collection name ─────────────────────────────────────────────────────
COLLECTION_NAME = "auraos_clinical_kb"

# ── Singleton ChromaDB client ──────────────────────────────────────────
_chroma_client = None
_collection = None


def _get_chroma():
    """Lazy-init ChromaDB client and collection."""
    global _chroma_client, _collection
    if _chroma_client is not None:
        return _collection

    if chromadb is None:
        print("[RAG] chromadb is not installed; RAG features are disabled.")
        return None

    try:
        _chroma_client = chromadb.Client(ChromaSettings(
            anonymized_telemetry=False,
            is_persistent=True,
            persist_directory=str(CHROMA_PERSIST_DIR),
        ))
        _collection = _chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        print(f"[RAG] ChromaDB ready. Collection '{COLLECTION_NAME}' "
              f"has {_collection.count()} documents.")
        return _collection
    except Exception as exc:
        print(f"[RAG] ChromaDB init failed: {exc}")
        _chroma_client = None
        _collection = None
        return None


# ═══════════════════════════════════════════════════════════════════════
#  INGESTION — Load clinical knowledge into vector store
# ═══════════════════════════════════════════════════════════════════════

def ingest_knowledge_base(force: bool = False) -> dict:
    """
    Reads all .txt files from clinical_knowledge/, chunks them using
    RecursiveCharacterTextSplitter, and upserts into ChromaDB.

    Only re-ingests if the collection is empty (or force=True).
    Returns {"status": ..., "documents": N, "chunks": N}.
    """
    collection = _get_chroma()
    if collection is None:
        return {"status": "disabled", "reason": "chromadb not available"}

    # Skip if already populated (unless forced)
    if collection.count() > 0 and not force:
        return {
            "status": "already_populated",
            "documents": collection.count(),
        }

    if RecursiveCharacterTextSplitter is None:
        return {"status": "disabled", "reason": "langchain-text-splitters not installed"}

    # Find all .txt files in knowledge directory
    txt_files = sorted(glob.glob(str(KNOWLEDGE_DIR / "*.txt")))
    if not txt_files:
        return {"status": "no_files", "path": str(KNOWLEDGE_DIR)}

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n---\n", "\n\n", "\n", ". ", " "],
    )

    all_chunks = []
    all_ids = []
    all_metadatas = []

    for filepath in txt_files:
        filename = os.path.basename(filepath)
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()

        chunks = splitter.split_text(text)
        for i, chunk in enumerate(chunks):
            chunk_id = f"{filename}::chunk_{i:04d}"
            all_chunks.append(chunk)
            all_ids.append(chunk_id)
            all_metadatas.append({
                "source_file": filename,
                "chunk_index": i,
                "total_chunks": len(chunks),
            })

    # Upsert into ChromaDB (uses default embedding function: all-MiniLM-L6-v2)
    # Batch in groups of 100 to avoid memory issues
    batch_size = 100
    for start in range(0, len(all_chunks), batch_size):
        end = start + batch_size
        collection.upsert(
            ids=all_ids[start:end],
            documents=all_chunks[start:end],
            metadatas=all_metadatas[start:end],
        )

    print(f"[RAG] Ingested {len(all_chunks)} chunks from {len(txt_files)} files.")
    return {
        "status": "ingested",
        "files": len(txt_files),
        "chunks": len(all_chunks),
    }


# ═══════════════════════════════════════════════════════════════════════
#  RETRIEVAL — Query the vector store for relevant clinical passages
# ═══════════════════════════════════════════════════════════════════════

def query_clinical_rag(query: str, n_results: int = 4) -> list[dict]:
    """
    Searches the clinical knowledge base for passages relevant to the query.
    Returns a list of {text, source, score} dicts.
    """
    collection = _get_chroma()
    if collection is None or collection.count() == 0:
        return []

    try:
        results = collection.query(
            query_texts=[query],
            n_results=min(n_results, collection.count()),
        )
    except Exception as exc:
        print(f"[RAG] Query failed: {exc}")
        return []

    passages = []
    if results and results.get("documents"):
        docs = results["documents"][0]
        metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
        dists = results["distances"][0] if results.get("distances") else [0.0] * len(docs)
        for doc, meta, dist in zip(docs, metas, dists):
            passages.append({
                "text": doc,
                "source": meta.get("source_file", "unknown"),
                "relevance_score": round(1.0 - dist, 3),  # cosine: lower distance = more relevant
            })

    return passages


# ═══════════════════════════════════════════════════════════════════════
#  GENERATION — Combine RAG context + user profile → LLM → protocol
# ═══════════════════════════════════════════════════════════════════════

@lru_cache(maxsize=1)
def _get_rag_llm():
    """Returns a Groq LLM instance configured for RAG generation."""
    if ChatGroq is None or not settings.GROQ_API_KEY:
        return None
    try:
        return ChatGroq(
            groq_api_key=settings.GROQ_API_KEY,
            model_name="llama3-8b-8192",
            temperature=0.4,  # Lower temp for clinical accuracy
            max_tokens=1200,
        )
    except Exception:
        return None


_RAG_PROMPT_TEMPLATE = """You are a clinical recovery protocol generator for AuraOS, a mental health app.
You synthesize evidence-based recommendations from real medical research.

USER PROFILE:
- Condition: {condition}
- Severity: {severity}
- Baseline Arousal Score: {arousal_score}/10

RETRIEVED CLINICAL EVIDENCE:
{rag_context}

Based on the clinical evidence above, generate a personalized recovery protocol.
You MUST only recommend interventions that are supported by the retrieved evidence.
Do NOT hallucinate or invent recommendations not in the evidence.

Respond in this exact JSON format (no markdown, no code fences):
{{
  "condition": "{condition}",
  "severity": "{severity}",
  "diet_recommendations": [
    {{
      "priority": 1,
      "category": "category name",
      "items": ["specific food 1", "specific food 2"],
      "rationale": "why this helps, citing the neurochemical mechanism",
      "frequency": "how often"
    }}
  ],
  "exercise_protocol": [
    {{
      "priority": 1,
      "type": "exercise type",
      "duration": "time and frequency",
      "intensity": "low/moderate/high",
      "rationale": "neurochemical mechanism from the evidence"
    }}
  ],
  "foods_to_avoid": ["food 1", "food 2"],
  "lifestyle_tips": ["tip 1", "tip 2"],
  "clinical_rationale": "2-3 sentence summary of the scientific basis",
  "sources": ["Harvard Nutritional Psychiatry", "Dr. Ratey - Spark"]
}}"""


def _fallback_protocol(condition: str, severity: str) -> dict:
    """Returns a minimal protocol when RAG or LLM is unavailable."""
    return {
        "condition": condition,
        "severity": severity,
        "diet_recommendations": [
            {
                "priority": 1,
                "category": "Anti-inflammatory basics",
                "items": ["leafy greens", "fatty fish", "berries", "nuts"],
                "rationale": "Anti-inflammatory foods support brain health and mood regulation.",
                "frequency": "Daily",
            }
        ],
        "exercise_protocol": [
            {
                "priority": 1,
                "type": "Walking",
                "duration": "30 minutes, 5x/week",
                "intensity": "moderate",
                "rationale": "Moderate aerobic exercise increases BDNF and serotonin production.",
            }
        ],
        "foods_to_avoid": ["refined sugar", "processed foods", "excessive caffeine"],
        "lifestyle_tips": [
            "Start with a 5-minute walk — momentum builds from tiny wins.",
            "Eat a source of protein at every meal for sustained energy.",
        ],
        "clinical_rationale": (
            "Based on nutritional psychiatry consensus and exercise neurochemistry research, "
            "anti-inflammatory nutrition combined with regular moderate exercise provides "
            "the strongest evidence-based foundation for mental health support."
        ),
        "sources": ["Harvard Nutritional Psychiatry", "Dr. John Ratey - Spark"],
        "_fallback": True,
    }


def generate_recovery_protocol(
    condition: str,
    severity: str = "moderate",
    arousal_score: int = 5,
) -> dict:
    """
    Full RAG pipeline:
    1. Query vector store with condition-specific prompt
    2. Format retrieved passages as context
    3. Send to Groq LLM with structured prompt
    4. Parse and return JSON protocol

    Falls back to a static protocol if RAG or LLM is unavailable.
    """
    # Step 1: Retrieve relevant clinical passages
    query = f"{condition} diet exercise protocol neurochemistry treatment"
    passages = query_clinical_rag(query, n_results=6)

    if not passages:
        print("[RAG] No passages retrieved; using fallback protocol.")
        return _fallback_protocol(condition, severity)

    # Step 2: Format context from retrieved passages
    rag_context = "\n\n".join(
        f"[Source: {p['source']}] (relevance: {p['relevance_score']})\n{p['text']}"
        for p in passages
    )

    # Step 3: Generate with LLM
    llm = _get_rag_llm()
    if llm is None or PromptTemplate is None:
        print("[RAG] LLM unavailable; using fallback protocol.")
        result = _fallback_protocol(condition, severity)
        # Still attach the RAG passages so frontend can display sources
        result["rag_passages"] = passages
        return result

    prompt = PromptTemplate(
        template=_RAG_PROMPT_TEMPLATE,
        input_variables=["condition", "severity", "arousal_score", "rag_context"],
    )

    try:
        chain = prompt | llm
        raw = chain.invoke({
            "condition": condition,
            "severity": severity,
            "arousal_score": str(arousal_score),
            "rag_context": rag_context,
        })
        content = str(raw.content).strip()

        # Parse JSON from LLM response
        import json
        # Strip markdown fences if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1]
        if content.endswith("```"):
            content = content.rsplit("```", 1)[0]
        content = content.strip()

        protocol = json.loads(content)
        protocol["rag_passages"] = passages
        protocol["_source"] = "rag_llm"
        return protocol

    except Exception as exc:
        print(f"[RAG] LLM generation failed: {exc}")
        result = _fallback_protocol(condition, severity)
        result["rag_passages"] = passages
        return result
