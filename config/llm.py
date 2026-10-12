import os
import logging
from config.settings import settings
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger("reworld")

def get_llm():
    api_key = (
        getattr(settings, "gemini_api_key", None)
        or getattr(settings, "google_api_key", None)
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
    )

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set.")

    configured_model = getattr(settings, "llm_model", "gemini-3.8-flash") or os.getenv("LLM_MODEL", "gemini-3.8-flash")
    if configured_model in ("gemini-3.6-flash", "gemini-1.5-flash", None, ""):
        configured_model = "gemini-3.8-flash"

    models_to_try = [
        configured_model,
        "gemini-3.8-flash",
        "gemini-3.8-pro",
        "gemini-2.5-flash",
    ]

    for m in models_to_try:
        try:
            return ChatGoogleGenerativeAI(
                model=m,
                google_api_key=api_key,
                temperature=0.7,
                timeout=15,
                max_retries=2,
            )
        except Exception as exc:
            logger.warning("Failed to initialize model %s: %s", m, exc)
            continue

    return ChatGoogleGenerativeAI(
        model="gemini-3.8-flash",
        google_api_key=api_key,
        temperature=0.7,
        timeout=15,
        max_retries=2,
    )

