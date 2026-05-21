"""Shared backend configuration helpers."""
import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent


def load_environment() -> None:
    """Load env files from predictable project locations."""
    for path in (
        PROJECT_DIR / ".env",
        PROJECT_DIR / ".env.local",
        BACKEND_DIR / ".env",
        BACKEND_DIR / ".env.local",
    ):
        load_dotenv(path, override=False)


def get_anthropic_api_key() -> str:
    """Support the canonical key name plus common Claude aliases."""
    load_environment()
    return (
        os.getenv("ANTHROPIC_API_KEY")
        or os.getenv("CLAUDE_API_KEY")
        or os.getenv("ANTHROPIC_KEY")
        or ""
    )


def get_anthropic_base_url() -> str:
    """Return an optional Anthropic-compatible API base URL."""
    load_environment()
    return (
        os.getenv("ANTHROPIC_BASE_URL")
        or os.getenv("ANTHROPIC_API_BASE")
        or os.getenv("CLAUDE_BASE_URL")
        or ""
    )
