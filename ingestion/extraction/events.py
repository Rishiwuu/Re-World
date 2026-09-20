from __future__ import annotations

import json
import logging
import os
import re
from core.world.events import Event, EventType

logger = logging.getLogger("reworld")


def extract_events(
    text: str,
    story_id: str,
    characters: list[str] | None = None,
) -> list[Event]:
    """
    Extract sequential chronological plot events using Gemini LLM
    with a deterministic fallback.
    """
    events: list[Event] = []
    char_list = characters or []

    # Try LLM extraction first
    try:
        if os.getenv("USE_LLM_INGESTION", "false").lower() != "true":
            raise RuntimeError("LLM ingestion disabled; using fast local extraction")
        from config.llm import get_llm
        llm = get_llm()
        if llm:
            prompt = f"""You are an expert narrative analyst. Extract 4 to 12 key sequential chronological events from the following story text.
Return ONLY a valid JSON array of objects with the following schema:
[
  {{
    "sequence": 1,
    "title": "Short event title (under 50 chars)",
    "description": "2-3 sentences describing the event beat",
    "participants": ["character_id_or_name"],
    "event_type": "plot"
  }}
]

Available Characters: {json.dumps(char_list)}

Story Text:
{text[:4500]}
"""
            response = llm.invoke(prompt)
            content = response.content
            if isinstance(content, list):
                content = "".join(
                    part.get("text", "") if isinstance(part, dict) else str(part)
                    for part in content
                )
            elif not isinstance(content, str):
                content = str(content)

            content_cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
            content_cleaned = re.sub(r"\s*```$", "", content_cleaned, flags=re.MULTILINE)

            json_match = re.search(r"\[\s*\{.*\}\s*\]", content_cleaned, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                for index, item in enumerate(parsed):
                    seq = index + 1
                    event_id = f"{story_id}_event_{seq}"
                    participants = [
                        re.sub(r"[^a-z0-9]+", "_", str(p).lower()).strip("_")
                        for p in item.get("participants", [])
                    ]
                    events.append(
                        Event(
                            id=event_id,
                            story_id=story_id,
                            title=item.get("title", f"Event {seq}")[:80],
                            description=item.get("description", ""),
                            sequence=seq,
                            event_type=EventType.PLOT,
                            participants=[p for p in participants if p],
                        )
                    )
                if events:
                    logger.info(f"LLM successfully extracted {len(events)} events.")
                    return events
    except Exception as e:
        logger.warning(f"LLM event extraction skipped: {e}")

    # Fallback: every uploaded story is segmented into chronological beats.
    # Paragraphs are presentation, not chronology: a whole story is commonly
    # pasted as one paragraph.  Sentences are therefore the primary boundary.
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+|\n+(?=[A-Z])", text)
        if sentence.strip()
    ]
    # A source without normal punctuation is divided into readable windows.
    if len(sentences) <= 1:
        words = text.split()
        window = 45
        sentences = [" ".join(words[i:i + window]) for i in range(0, len(words), window)]

    # One beat per sentence up to twelve points; longer stories are grouped
    # evenly so the timeline remains legible but never collapses to one point.
    chunk_size = max(1, (len(sentences) + 11) // 12)
    paragraphs = [
        " ".join(sentences[i:i + chunk_size])
        for i in range(0, len(sentences), chunk_size)
        if " ".join(sentences[i:i + chunk_size]).strip()
    ]

    for index, paragraph in enumerate(paragraphs[:15]):
        seq = index + 1
        event_id = f"{story_id}_event_{seq}"

        first_sentence = paragraph.split(".")[0].strip()
        title = first_sentence[:60] if first_sentence else f"Event {seq}"

        # Match participants by checking if character ids/names occur in the paragraph
        participants = []
        lowered_para = paragraph.lower()
        for cid in char_list:
            clean_name = cid.replace("_", " ")
            if clean_name in lowered_para or cid in lowered_para:
                participants.append(cid)

        events.append(
            Event(
                id=event_id,
                story_id=story_id,
                title=title,
                description=paragraph,
                sequence=seq,
                event_type=EventType.PLOT,
                participants=participants,
            )
        )

    return events
