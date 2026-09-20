from __future__ import annotations

import json
import logging
import os
import re
from core.world.characters import CharacterState

logger = logging.getLogger("reworld")


def extract_characters(text: str) -> list[CharacterState]:
    """
    Extract significant characters from narrative text using Gemini LLM
    with a robust deterministic NLP fallback.
    """
    characters: dict[str, CharacterState] = {}

    # Try LLM-based extraction first
    try:
        if os.getenv("USE_LLM_INGESTION", "false").lower() != "true":
            raise RuntimeError("LLM ingestion disabled; using fast local extraction")
        from config.llm import get_llm
        llm = get_llm()
        if llm:
            prompt = f"""You are an expert narrative analyst. Extract all main and supporting characters from the following story text.
Return ONLY a valid JSON array of objects with the following schema for each character:
[
  {{
    "id": "snake_case_id",
    "name": "Full Character Name",
    "description": "Short 1-2 sentence description of who they are and their role",
    "personality": ["trait1", "trait2"],
    "goals": ["goal1", "goal2"],
    "aliases": ["alias1"],
    "current_location": "location if known or null",
    "alive": true
  }}
]

Story Text (sample):
{text[:4000]}
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

            # Strip markdown formatting like ```json ... ```
            content_cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
            content_cleaned = re.sub(r"\s*```$", "", content_cleaned, flags=re.MULTILINE)
            
            # Find JSON array
            json_match = re.search(r"\[\s*\{.*\}\s*\]", content_cleaned, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                for item in parsed:
                    cid = re.sub(r"[^a-z0-9]+", "_", item.get("id", item.get("name", "")).lower()).strip("_")
                    if cid and item.get("name"):
                        characters[cid] = CharacterState(
                            id=cid,
                            name=item.get("name", cid.title()),
                            description=item.get("description", ""),
                            personality=item.get("personality", []),
                            goals=item.get("goals", []),
                            aliases=item.get("aliases", []),
                            current_location=item.get("current_location"),
                            alive=item.get("alive", True),
                        )
                if characters:
                    logger.info(f"LLM successfully extracted {len(characters)} characters.")
                    return list(characters.values())
    except Exception as e:
        logger.warning(f"LLM character extraction skipped: {e}")

    # Fallback: Multi-strategy NLP heuristic extraction
    # 1. Dialogue speaker pattern (NAME: dialogue)
    for match in re.finditer(r"(?m)^([A-Z][A-Za-z0-9 _'-]{1,35}):", text):
        name = match.group(1).strip()
        key = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        if key and len(key) > 2 and key not in characters:
            characters[key] = CharacterState(
                id=key,
                name=name,
                description=f"Character appearing in dialogue.",
                alive=True,
            )

    # 2. Capitalized Multi-word / Name patterns (e.g., "Portgas D. Ace", "Monkey D. Luffy", "Detective Hale")
    stopwords = {
        "The", "A", "An", "In", "On", "At", "To", "For", "With", "By", "From",
        "He", "She", "It", "They", "We", "You", "I", "His", "Her", "Their",
        "Then", "When", "After", "Before", "While", "Suddenly", "However", "Meanwhile",
        "Chapter", "Part", "Scene", "Act", "First", "Second", "Next", "Finally"
    }

    # Match 1-3 capitalized words as names
    name_candidates = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+|\s+[A-Z]\.|\s+D\.\s+[A-Z][a-z]+)*)\b", text)
    candidate_counts: dict[str, int] = {}
    for cand in name_candidates:
        cand_words = cand.split()
        if cand in stopwords or (len(cand_words) == 1 and cand in stopwords):
            continue
        if len(cand) > 2:
            candidate_counts[cand] = candidate_counts.get(cand, 0) + 1

    # Filter candidates with at least 2 occurrences or multi-word names
    for name, count in sorted(candidate_counts.items(), key=lambda x: -x[1]):
        if count >= 2 or len(name.split()) >= 2:
            key = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
            if key and len(key) > 2 and key not in characters and len(characters) < 10:
                characters[key] = CharacterState(
                    id=key,
                    name=name,
                    description=f"Significant persona in the narrative.",
                    alive=True,
                )

    # If still empty, create at least one default protagonist entity based on text
    if not characters:
        characters["protagonist"] = CharacterState(
            id="protagonist",
            name="Protagonist",
            description="The central character of the story.",
            alive=True,
        )

    return list(characters.values())
