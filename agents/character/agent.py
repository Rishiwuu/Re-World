from __future__ import annotations

import logging
import re
from agents.shared import AgentResult, CharacterRequest
from agents.character.prompts import SYSTEM_PROMPT
from tools.character_memory import get_character_knowledge
from tools.story_search import search_story
from tools.world_state import get_world_state

logger = logging.getLogger("reworld")


class CharacterAgent:

    def __init__(self, llm=None):
        if llm is not None:
            self.llm = llm
        else:
            try:
                from config.llm import get_llm
                self.llm = get_llm()
            except Exception as e:
                logger.warning(f"LLM not available for CharacterAgent: {e}")
                self.llm = None

    def respond(self, request: CharacterRequest) -> AgentResult:
        world_state = get_world_state(
            request.story_id,
            request.branch_id,
        )
        if world_state is None and request.branch_id != "canon":
            world_state = get_world_state(request.story_id, "canon")

        if world_state is None:
            return AgentResult(
                success=False,
                errors=["World state not found."],
            )

        character = world_state.get_character(
            request.character_id
        )
        if character is None:
            return AgentResult(
                success=False,
                errors=["Character not found."],
            )

        effective_sequence = request.sequence if request.sequence > 0 else world_state.current_point.sequence
        knowledge = get_character_knowledge(
            world_state,
            request.character_id,
            effective_sequence,
        )

        # Retrieval is useful only when it belongs to this story and does not
        # leak information from a later point on the timeline.
        retrieved = [
            result for result in search_story(request.message, limit=10)
            if result.metadata.get("story_id") == request.story_id
            and result.metadata.get("sequence", effective_sequence) <= effective_sequence
        ][:5]
        relationships = [
            relationship.model_dump()
            for relationship in world_state.relationships.values()
            if relationship.valid_from_sequence <= effective_sequence
            and (relationship.character_a == character.id or relationship.character_b == character.id)
        ]

        context = {
            "character": character.model_dump(),
            "knowledge": [
                fact.model_dump()
                for fact in knowledge
            ],
            "source_evidence": [
                result.text
                for result in retrieved
            ],
            "relationships": relationships,
            "sequence": effective_sequence,
            "user_message": request.message,
            "conversation": request.conversation[-12:],
        }

        if self.llm is None:
            return AgentResult(
                success=True,
                output=self._fallback_response(character, knowledge, request.message),
                metadata={
                    "context": context,
                    "character_id": character.id,
                    "sequence": effective_sequence,
                },
            )

        try:
            response = self.llm.invoke([
                ("system", SYSTEM_PROMPT),
                ("human", self._build_prompt(context)),
            ])

            output_text = response.content
            if isinstance(output_text, list):
                output_text = "".join(
                    part.get("text", "") if isinstance(part, dict) else str(part)
                    for part in output_text
                )
            elif not isinstance(output_text, str):
                output_text = str(output_text)

            return AgentResult(
                success=True,
                output=output_text,
                metadata={
                    "character_id": character.id,
                    "sequence": effective_sequence,
                    "knowledge_count": len(knowledge),
                    "context": context,
                },
            )
        except Exception as e:
            logger.error(f"Character LLM error: {e}")
            return AgentResult(
                success=True,
                # Do not substitute a generic role-play line for an answer.
                # The local evidence-only responder is more accurate than an
                # unavailable provider and still respects the time boundary.
                output=self._fallback_response(character, knowledge, request.message),
                metadata={
                    "character_id": character.id,
                    "sequence": effective_sequence,
                    "knowledge_count": len(knowledge),
                    "context": context,
                    "error": str(e),
                },
            )

    def _build_prompt(self, context: dict) -> str:
        return f"""Character:
{context["character"]}

Known facts (strictly bounded to timeline position sequence <= {context["sequence"]}):
{context["knowledge"]}

Relationships that shape this character's feelings and loyalties:
{context["relationships"]}

Source evidence:
{context["source_evidence"]}

Timeline sequence:
{context["sequence"]}

User:
{context["user_message"]}

Recent conversation (continue it naturally; do not repeat it or label roles):
{context["conversation"]}

Reply as this character speaking in first person, not as a narrator or an AI.
Do not explain the character's personality or describe what the character would
do. Simply be them in this moment and respond directly to the user's message.
Stay in the scene. Let the character's voice emerge through emotional reactions,
priorities, rhythm, and relationship-driven stakes. A short action in asterisks
is allowed only when it feels natural. Never summarize the profile or quote raw
fact text as if reading a report.
Do not mention events or facts beyond sequence {context["sequence"]}.
"""

    def _fallback_response(self, character, knowledge, message: str) -> str:
        """Human dialogue fallback when the provider is temporarily unavailable."""
        facts = [fact.statement for fact in knowledge]
        if not facts:
            return (
                f"{character.name}: I... I don't know enough about that yet. "
                "Please don't ask me to pretend that I do."
            )

        query_words = set(re.findall(r"[a-zA-Z]{3,}", message.lower()))
        ranked = sorted(
            facts,
            key=lambda fact: len(query_words.intersection(
                re.findall(r"[a-zA-Z]{3,}", fact.lower())
            )),
            reverse=True,
        )
        evidence = [fact for fact in ranked if any(
            word in fact.lower() for word in query_words
        )][:3] or facts[:3]
        memory = self._naturalize_fact(evidence[0])
        traits = set(trait.lower() for trait in character.personality)
        if re.search(r"\b(died|dead|dying|death|kill)\b", message, re.IGNORECASE):
            reaction = "No... wait. That can't be true."
        elif re.search(r"\b(danger|attack|threat|alarm|fight)\b", message, re.IGNORECASE):
            reaction = "Hold on—don't rush in without thinking."
        elif "determined" in traits or "brave" in traits:
            reaction = "Then we can't waste another second."
        elif "cautious" in traits or "analytical" in traits:
            reaction = "Give me a moment. Something about this doesn't sit right."
        else:
            reaction = "I hear you."

        if "analytical" in traits or "cautious" in traits:
            follow_up = "Tell me exactly what you saw."
        elif "empathetic" in traits or "compassionate" in traits:
            follow_up = "Are you hurt? Stay with me."
        elif "determined" in traits or "brave" in traits:
            follow_up = "I'm not backing down."
        else:
            follow_up = "We need to be careful."
        return f"{character.name}: {reaction} {memory}. {follow_up}"

    @staticmethod
    def _naturalize_fact(fact: str) -> str:
        """Remove internal branch metadata before it reaches character dialogue."""
        cleaned = re.sub(
            r"\b(?:divergence|alternate (?:timeline|outcome)|timeline diverged|generated|canon)\b\s*:?",
            "",
            fact,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(r"\bIn this .*?:\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bIn this\b\s*:? ?", "", cleaned, flags=re.IGNORECASE)
        # Branch records sometimes repeat the same premise after metadata.
        clauses = [part.strip() for part in re.split(r"\s*:\s*", cleaned) if part.strip()]
        if clauses:
            cleaned = clauses[-1]
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" .:-")
        return cleaned[:350] or "I can feel that something is terribly wrong."
