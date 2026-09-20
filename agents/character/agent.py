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

        # Find divergence sequence if on a branch
        divergence_seq = None
        if world_state.branch_id != "canon":
            for e in world_state.events.values():
                if not e.canonical and e.sequence > 0:
                    if divergence_seq is None or e.sequence < divergence_seq:
                        divergence_seq = e.sequence

        # Source evidence: filter out canon chunks that conflict with branch timeline
        retrieved_raw = search_story(request.message, limit=10)
        source_evidence = []
        for r in retrieved_raw:
            if r.metadata.get("story_id") == request.story_id:
                seq = r.metadata.get("sequence", effective_sequence)
                if seq <= effective_sequence:
                    if world_state.branch_id != "canon" and divergence_seq is not None and seq >= divergence_seq:
                        continue
                    source_evidence.append(r.text)

        # Include timeline events up to effective_sequence as core evidence
        timeline_events = sorted(
            [e for e in world_state.events.values() if e.sequence <= effective_sequence],
            key=lambda e: e.sequence,
        )
        for e in timeline_events:
            source_evidence.append(f"Seq {e.sequence} ({e.title}): {e.description}")

        current_event = None
        for e in timeline_events:
            if e.sequence == effective_sequence:
                current_event = e
                break
        if not current_event and timeline_events:
            current_event = timeline_events[-1]

        current_scene_str = (
            f"Sequence {effective_sequence} ({current_event.title}): {current_event.description}"
            if current_event
            else f"Sequence {effective_sequence}: Scene in progress"
        )

        relationships = [
            relationship.model_dump()
            for relationship in world_state.relationships.values()
            if relationship.valid_from_sequence <= effective_sequence
            and (relationship.character_a == character.id or relationship.character_b == character.id)
        ]

        clean_knowledge = [
            self._naturalize_fact(fact.statement)
            for fact in knowledge
        ]

        context = {
            "character": character.model_dump(),
            "knowledge": clean_knowledge,
            "source_evidence": source_evidence,
            "relationships": relationships,
            "sequence": effective_sequence,
            "current_scene": current_scene_str,
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
        current_scene = context.get("current_scene", f"Sequence {context['sequence']}")
        knowledge_lines = "\n".join(f"- {f}" for f in context["knowledge"]) or "No additional past memories recorded."
        evidence_lines = "\n".join(f"- {e}" for e in context["source_evidence"]) or "No additional source excerpts."
        rel_lines = "\n".join(
            f"- {r.get('character_a')} & {r.get('character_b')}: {r.get('relationship_type', '')} (Trust: {r.get('trust_level', 0)})"
            for r in context["relationships"]
        ) or "No special relationships recorded."
        conv_lines = "\n".join(
            f"{msg.get('role', 'user')}: {msg.get('content', '')}"
            for msg in context["conversation"]
        ) or "No prior messages."

        char = context["character"]
        traits = ", ".join(char.get("personality", [])) if isinstance(char.get("personality"), list) else str(char.get("personality", ""))

        return f"""CHARACTER PROFILE:
Name: {char.get('name', 'Character')}
Description: {char.get('description', '')}
Personality Traits: {traits}

CURRENT MOMENT / SCENE POSITION:
{current_scene}

YOUR MEMORIES & FACTS UP TO THIS SCENE (Sequence <= {context['sequence']}):
{knowledge_lines}

TIMELINE EVIDENCE:
{evidence_lines}

RELATIONSHIPS:
{rel_lines}

RECENT CONVERSATION:
{conv_lines}

USER MESSAGE:
"{context['user_message']}"

INSTRUCTIONS FOR YOUR RESPONSE:
1. Speak 100% as {char.get('name')} in first-person ("I", "my").
2. Respond DIRECTLY to what the user said, staying completely in-character in this exact current scene (Sequence {context['sequence']}).
3. Use ONLY your memories and events up to Sequence {context['sequence']}. Never mention or act on events after sequence {context['sequence']} or from alternate timelines.
4. Express genuine emotion, physical gestures/actions in *asterisks*, and realistic conversational tone. Make it feel like an authentic Character.AI chat response.
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
        return f"*Pauses thoughtfully.* {reaction} {memory} {follow_up}"

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
