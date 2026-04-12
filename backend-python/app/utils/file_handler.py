from __future__ import annotations

import os
import tempfile
from pathlib import Path


def save_temp_bytes(*, data: bytes, suffix: str = "") -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    Path(path).write_bytes(data)
    return path
