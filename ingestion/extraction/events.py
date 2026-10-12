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
    with a deterministic fallback that partitions story text into distinct scene beats.
    """
    events: list[Event] = []
    char_list = characters or []

    # 1. Try LLM extraction first
    try:
        from config.llm import get_llm
        llm = get_llm()
        if llm:
            prompt = f"""You are an expert narrative architect.
Break down the following story into 4 to 12 distinct, chronological sequence beats (scenes/events).

CRITICAL REQUIREMENTS:
1. Each sequence beat MUST represent a DIFFERENT, PROGRESSIVE part of the story (e.g., Sequence 1 = Opening/Inciting Incident, Sequence 2 = Investigation/Rising Action, Sequence 3 = Turning Point/Crisis, Sequence 4 = Climax, Sequence 5 = Resolution).
2. DO NOT output the whole story in a single sequence, and DO NOT repeat the same story across multiple sequences.
3. The description for each beat MUST ONLY describe the specific actions and revelations that occur in that particular sequence beat (2-4 sentences).
4. Provide a dramatic, specific title for each beat (under 60 chars).
5. List the character IDs/names who actually participate or appear in that beat.

Schema (return ONLY a valid JSON array):
[
  {{
    "sequence": 1,
    "title": "Dramatic Beat Title",
    "description": "Specific narrative description of what happens only in this scene beat.",
    "participants": ["character_name_or_id"],
    "event_type": "plot"
  }}
]

Available Characters: {json.dumps(char_list)}

Story Text:
{text[:9000]}
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
                    seq = int(item.get("sequence", index + 1))
                    event_id = f"{story_id}_event_{seq}"
                    participants = [
                        re.sub(r"[^a-z0-9]+", "_", str(p).lower()).strip("_")
                        for p in item.get("participants", [])
                    ]
                    desc = str(item.get("description", "")).strip()
                    title = str(item.get("title", f"Sequence {seq}")).strip()
                    if desc:
                        events.append(
                            Event(
                                id=event_id,
                                story_id=story_id,
                                title=title[:80],
                                description=desc,
                                sequence=seq,
                                event_type=EventType.PLOT,
                                participants=[p for p in participants if p],
                            )
                        )
                if len(events) >= 2:
                    logger.info(f"LLM successfully extracted {len(events)} distinct sequence beats.")
                    return sorted(events, key=lambda e: e.sequence)
    except Exception as e:
        logger.warning(f"LLM event extraction fallback activated: {e}")

    # 2. Deterministic Fallback: Partition the story into distinct chronological narrative beats
    # Protect common abbreviations from being split as sentence boundaries
    protected_text = text
    abbreviations = ["Dr.", "Mr.", "Mrs.", "Ms.", "Prof.", "Capt.", "Lt.", "Sgt.", "St.", "vs.", "e.g.", "i.e."]
    for abbr in abbreviations:
        placeholder = abbr.replace(".", "___DOT___")
        protected_text = protected_text.replace(abbr, placeholder)

    # Step A: Split into natural paragraphs or sentence groups
    raw_paras = [p.strip() for p in re.split(r"\n\s*\n|\r\n\s*\r\n", protected_text) if p.strip()]

    all_sentences = []
    if len(raw_paras) >= 4:
        story_chunks = [p.replace("___DOT___", ".") for p in raw_paras]
    else:
        for para in raw_paras if raw_paras else [protected_text]:
            sents = [s.strip() for s in re.split(r"(?<=[.!?])(?:\s+|\n+)|\n+(?=[A-Z0-9\"'“‘])", para) if s.strip()]
            all_sentences.extend(sents)

        # Restore dots and merge any fragments under 20 chars
        clean_sentences = []
        for s in all_sentences:
            s_restored = s.replace("___DOT___", ".")
            if clean_sentences and len(clean_sentences[-1]) < 25:
                clean_sentences[-1] = clean_sentences[-1] + " " + s_restored
            else:
                clean_sentences.append(s_restored)

        # If text lacked standard punctuation, divide into readable 35-word windows
        if len(clean_sentences) <= 1:
            words = text.split()
            window = 35
            clean_sentences = [" ".join(words[i:i + window]) for i in range(0, len(words), window) if words[i:i + window]]

        total_sents = len(clean_sentences)
        if total_sents <= 6:
            story_chunks = clean_sentences
        else:
            num_chunks = min(12, max(4, (total_sents + 1) // 2))
            chunk_size = max(1, (total_sents + num_chunks - 1) // num_chunks)
            story_chunks = [
                " ".join(clean_sentences[i:i + chunk_size])
                for i in range(0, total_sents, chunk_size)
                if " ".join(clean_sentences[i:i + chunk_size]).strip()
            ]

    # Narrative phase labels for contextual titles
    phase_labels = [
        "Prologue & Opening",
        "Inciting Incident",
        "Initial Investigation",
        "Rising Complications",
        "Pivotal Discovery",
        "Hidden Confrontation",
        "Crisis & Climax",
        "Falling Action",
        "Resolution & Truth",
        "Epilogue",
        "Aftermath",
        "Closing Record",
    ]

    for index, chunk in enumerate(story_chunks[:12]):
        seq = index + 1
        event_id = f"{story_id}_event_{seq}"

        # Build a distinct descriptive title from the chunk
        first_sentence = chunk.split(".")[0].strip()
        first_words = " ".join(first_sentence.split()[:8])
        phase = phase_labels[min(index, len(phase_labels) - 1)]

        if first_words and len(first_words) > 10:
            title = f"{phase}: {first_words}"
        else:
            title = f"{phase} (Beat {seq})"

        # Identify participants mentioned in this specific chunk
        participants = []
        lowered_chunk = chunk.lower()
        for cid in char_list:
            clean_name = cid.replace("_", " ")
            if clean_name in lowered_chunk or cid in lowered_chunk:
                participants.append(cid)

        events.append(
            Event(
                id=event_id,
                story_id=story_id,
                title=title[:80],
                description=chunk,
                sequence=seq,
                event_type=EventType.PLOT,
                participants=participants if participants else (char_list[:2] if char_list else []),
            )
        )

    return events
