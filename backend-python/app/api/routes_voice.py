"""
Backward-compat shim.

The repo structure now uses `routes_audio.py` for voice telemetry & stress endpoints.
"""

from app.api.routes_audio import router  # re-export
