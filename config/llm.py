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

    model_name = getattr(settings, "llm_model", "gemini-2.5-flash") or "gemini-2.5-flash"

    # Try preferred model or standard Gemini flash models
    for m in [model_name, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]:
        try:
            return ChatGoogleGenerativeAI(
                model=m,
                google_api_key=api_key,
                temperature=0.3,
                timeout=15,
                max_retries=1,
            )
        except Exception as exc:
            logger.warning("Failed to initialize model %s: %s", m, exc)
            continue

    return ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=api_key,
        temperature=0.3,
        timeout=15,
        max_retries=1,
    )
