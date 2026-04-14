"""
Backward-compat shim.

The repo structure now uses `routes_tasks.py` for LangChain/ADHD task endpoints.
"""

from app.api.routes_tasks import router  # re-export
