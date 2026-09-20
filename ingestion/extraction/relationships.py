from __future__ import annotations

import json
import logging
import os
import re
from core.world.relationships import RelationshipState

logger = logging.getLogger("reworld")


def extract_relationships(
    text: str,
    character_ids: list[str],
) -> list[RelationshipState]:
    """
    Extract relationships between characters using Gemini LLM with co-occurrence fallback.
    """
    relationships: list[RelationshipState] = []
    if len(character_ids) < 2:
        return relationships

    # Try LLM extraction
    try:
        if os.getenv("USE_LLM_INGESTION", "false").lower() != "true":
            raise RuntimeError("LLM ingestion disabled; using fast local extraction")
        from config.llm import get_llm
        llm = get_llm()
        if llm:
            prompt = f"""You are a narrative analyst. Extract the relationships between the characters in this story.
Available character IDs: {json.dumps(character_ids)}

Return ONLY a valid JSON array of objects with the following schema:
[
  {{
    "character_a": "character_id_1",
    "character_b": "character_id_2",
    "relationship_type": "allies|rivals|family|associates|enemies",
    "strength": 0.5,
    "description": "Short explanation of their dynamic"
  }}
]

Story Text:
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

            content_cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
            content_cleaned = re.sub(r"\s*```$", "", content_cleaned, flags=re.MULTILINE)

            json_match = re.search(r"\[\s*\{.*\}\s*\]", content_cleaned, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                for item in parsed:
                    ca = re.sub(r"[^a-z0-9]+", "_", str(item.get("character_a", "")).lower()).strip("_")
                    cb = re.sub(r"[^a-z0-9]+", "_", str(item.get("character_b", "")).lower()).strip("_")
                    if ca and cb and ca != cb:
                        rel_id = f"{ca}_{cb}"
                        relationships.append(
                            RelationshipState(
                                id=rel_id,
                                character_a=ca,
                                character_b=cb,
                                relationship_type=item.get("relationship_type", "associates"),
                                strength=float(item.get("strength", 0.0)),
                                description=item.get("description", "Characters interact in the story."),
                                valid_from_sequence=1,
                            )
                        )
                if relationships:
                    logger.info(f"LLM successfully extracted {len(relationships)} relationships.")
                    return relationships
    except Exception as e:
        logger.warning(f"LLM relationship extraction skipped: {e}")

    # Fallback co-occurrence
    lowered = text.lower()
    for index, first in enumerate(character_ids):
        for second in character_ids[index + 1:]:
            first_name = first.replace("_", " ")
            second_name = second.replace("_", " ")

            if first_name in lowered and second_name in lowered:
                relationship_id = f"{first}_{second}"
                relationships.append(
                    RelationshipState(
                        id=relationship_id,
                        character_a=first,
                        character_b=second,
                        relationship_type="associated",
                        strength=0.0,
                        description="Characters appear in the same source material.",
                        valid_from_sequence=1,
                    )
                )

    return relationships
