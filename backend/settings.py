"""
Runtime settings: the API key and which models sit on the council.

config.py holds the defaults. Anything saved from the app's Settings panel is
written to data/settings.json and wins over those defaults, so you can change
your judges without editing code or restarting the server.

The API key is kept in .env (which is gitignored) and is never sent back to
the browser.
"""

import json
import os
from pathlib import Path
from typing import List, Optional

from . import config

ROOT = Path(__file__).resolve().parent.parent
SETTINGS_FILE = ROOT / "data" / "settings.json"
ENV_FILE = ROOT / ".env"

_cache = None


def _load() -> dict:
    """Read data/settings.json, remembering it so we don't hit disk every call."""
    global _cache
    if _cache is None:
        _cache = {}
        if SETTINGS_FILE.exists():
            try:
                _cache = json.loads(SETTINGS_FILE.read_text())
            except (json.JSONDecodeError, OSError):
                _cache = {}
    return _cache


def get_council_models() -> List[str]:
    return _load().get("council_models") or list(config.COUNCIL_MODELS)


def get_chairman_model() -> str:
    return _load().get("chairman_model") or config.CHAIRMAN_MODEL


def get_api_key() -> Optional[str]:
    # os.environ wins so a key saved from the UI applies without a restart
    return os.getenv("OPENROUTER_API_KEY") or config.OPENROUTER_API_KEY


def has_api_key() -> bool:
    key = get_api_key()
    return bool(key) and key != "paste-your-key-here"


def key_preview() -> Optional[str]:
    """A safe-to-display version of the key, e.g. sk-or-v1-abc...7f9x."""
    if not has_api_key():
        return None
    key = get_api_key()
    return f"{key[:12]}...{key[-4:]}" if len(key) > 20 else "set"


def save_models(council_models: List[str], chairman_model: str):
    data = _load()
    data["council_models"] = council_models
    data["chairman_model"] = chairman_model
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(data, indent=2))


def save_api_key(key: str):
    """Replace the key in .env, leaving any other lines in that file alone."""
    lines = []
    if ENV_FILE.exists():
        lines = [
            line for line in ENV_FILE.read_text().splitlines()
            if not line.startswith("OPENROUTER_API_KEY=")
        ]
    lines.append(f"OPENROUTER_API_KEY={key}")
    ENV_FILE.write_text("\n".join(lines) + "\n")

    # apply it right away instead of waiting for a restart
    os.environ["OPENROUTER_API_KEY"] = key
