from __future__ import annotations

import json
import logging
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agents.shared import NarrativeRequest
from core.world import Event, EventType, KnowledgeFact, Provenance
from tools.branch_manager import create_branch, clone_world_state, get_branch, _branches
from tools.world_state import get_world_state, save_world_state

router = APIRouter(prefix="/branches", tags=["branches"])
logger = logging.getLogger("reworld")

# Lazy agent
_narrative_agent = None


def _generate_heuristic_story_beat(change: str, event: Event, index: int = 0, total: int = 1) -> dict[str, str]:
    """Generate a creative progressive narrative beat when LLM is offline or rate-limited."""
    change_clean = change.strip().rstrip(".")
    clean_title = re.sub(r"^(Alternate Outcome:|Divergence:|Child Branch:|Shifted Plot:)\s*", "", event.title, flags=re.IGNORECASE).strip()

    phases = [
        ("Immediate Aftermath", "In the immediate wake of the divergence,"),
        ("Cascade Effect", "As consequence ripples through the timeline,"),
        ("New Complication", "An unforeseen development emerges when"),
        ("Tipping Point", "The tension escalates dramatically as"),
        ("Alternate Climax", "The altered timeline reaches a pivotal turning point:"),
        ("Altered Resolution", "The final outcome of this divergent path crystallizes:"),
    ]
    phase_title, phase_intro = phases[min(index, len(phases) - 1)]

    new_title = f"{phase_title}: {clean_title}"
    base_desc = event.description.strip()
    if not base_desc.endswith("."):
        base_desc += "."

    if index == 0:
        new_desc = (
            f"{phase_intro} the premise holds: \"{change_clean}\". "
            f"This immediately changes what was supposed to happen ({clean_title.lower()}). "
            f"Characters in attendance must react to this new reality on the spot."
        )
    elif index == total - 1:
        new_desc = (
            f"{phase_intro} the culmination of events diverges permanently from the original record. "
            f"Rather than the original sequence ({clean_title.lower()}), "
            f"new truths come to light that resolve this branch with lasting impact."
        )
    else:
        new_desc = (
            f"{phase_intro} the ripple effects alter how {clean_title.lower()} unfolds. "
            f"Witnesses, evidence, and character allegiances shift, creating new tensions."
        )

    return {
        "title": new_title[:120],
        "description": new_desc[:1000],
    }


def _alternate_outcomes(change: str, events: list[Event]) -> dict[str, dict[str, str]]:
    """Generate distinct downstream sequential scene beats based strictly on the user's What-If premise."""
    if not events:
        return {}

    total_evs = len(events)
    fallback = {
        event.id: _generate_heuristic_story_beat(change, event, index=i, total=total_evs)
        for i, event in enumerate(events)
    }

    try:
        from config.llm import get_llm
        llm = get_llm()
        logger.info("Generating alternate outcomes with LLM for change: %s", change)
        source = "\n".join(
            f"ID: {event.id} | Sequence: {event.sequence} | Original Title: {event.title} | Original Beat: {event.description}"
            for event in events[:12]
        )

        prompt = (
            f"You are a master fiction author rewriting a narrative timeline based on a 'What-If' premise.\n\n"
            f"WHAT-IF PREMISE:\n"
            f"\"{change}\"\n\n"
            f"ORIGINAL DOWNSTREAM STORY BEATS (CHRONOLOGICAL SEQUENCE):\n{source}\n\n"
            f"TASK:\n"
            f"Rewrite EACH of the downstream story beats into a realistic, dramatic alternate scene that follows chronologically from the What-If premise.\n\n"
            f"CRITICAL REQUIREMENTS:\n"
            f"1. Each sequence beat MUST be a DISTINCT, progressive scene describing only what happens in that specific sequence beat.\n"
            f"2. DO NOT output the whole story in one beat and DO NOT repeat the same narrative across beats.\n"
            f"3. Beat 1 after divergence shows immediate reaction, Beat 2 shows escalating conflict/investigation, subsequent beats show the new climax and resolution.\n"
            f"4. Describe specific actions, character dialogue, clues, and revelations.\n"
            f"5. Provide an alternate title and description for EVERY event ID listed above.\n\n"
            f"Output Requirement: Return ONLY a valid JSON array of objects:\n"
            f"[\n"
            f"  {{\n"
            f"    \"id\": \"exact_event_id_from_above\",\n"
            f"    \"sequence\": 6,\n"
            f"    \"title\": \"Dramatic Alternate Event Title\",\n"
            f"    \"description\": \"Immersive 2-4 sentence story narrative detailing what specifically happens in this beat.\"\n"
            f"  }}\n"
            f"]"
        )

        response = llm.invoke(prompt)
        content = response.content
        if isinstance(content, list):
            content = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )
        elif not isinstance(content, str):
            content = str(content)

        # Clean markdown wrappers if present
        content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
        content = re.sub(r"\s*```$", "", content, flags=re.MULTILINE)

        match = re.search(r"\[\s*\{.*\}\s*\]", content, re.DOTALL)
        if match:
            generated = json.loads(match.group(0))
            by_id = {str(item.get("id", "")).strip(): item for item in generated if item.get("id")}
            by_seq = {}
            for item in generated:
                if item.get("sequence") is not None:
                    try:
                        by_seq[int(item["sequence"])] = item
                    except (ValueError, TypeError):
                        pass

            for i, event in enumerate(events):
                item = (
                    by_id.get(event.id)
                    or by_id.get(f"{event.story_id}_event_{event.sequence}")
                    or by_id.get(f"event_{event.sequence}")
                    or by_id.get(str(event.sequence))
                    or by_seq.get(event.sequence)
                    or (generated[i] if i < len(generated) and isinstance(generated[i], dict) else None)
                )
                if item and item.get("description"):
                    desc = str(item["description"]).strip()
                    title = str(item.get("title") or fallback[event.id]["title"]).strip()
                    if desc:
                        fallback[event.id] = {
                            "title": title[:120],
                            "description": desc[:1000],
                        }
            logger.info("Successfully generated %d alternate beats via LLM.", len(generated))
    except Exception as exc:
        logger.warning("Alternate story generation used fallback narrative: %s", exc)

    return fallback



def _get_narrative_agent():
    global _narrative_agent
    if _narrative_agent is None:
        from agents.narrative import NarrativeAgent
        try:
            from config.llm import get_llm
            llm = get_llm()
        except Exception:
            llm = None
        _narrative_agent = NarrativeAgent(llm=llm)
    return _narrative_agent


# ---------- Schemas ----------

class BranchCreateRequest(BaseModel):
    story_id: str
    parent_branch_id: str = "canon"
    sequence: int = Field(ge=0)
    change: str


class BranchInfo(BaseModel):
    id: str
    story_id: str
    name: str
    description: str = ""
    parent_branch_id: str | None = None
    divergence_event_id: str | None = None
    divergence_sequence: int = 0
    canonical: bool = False


class BranchCreateResponse(BaseModel):
    branch: BranchInfo
    affected_events: int
    affected_characters: list[str]
    consequence_description: str = ""


class DiffEntry(BaseModel):
    event_id: str
    title: str
    change_type: str  # added, removed, changed
    canon_description: str = ""
    branch_description: str = ""
    sequence: int = 0


class BranchDiffResponse(BaseModel):
    branch_id: str
    canon_branch_id: str
    events_added: list[DiffEntry]
    events_removed: list[DiffEntry]
    events_changed: list[DiffEntry]
    characters_affected: list[str]
    relationships_changed: int
    ripple_depth: int
    total_changes: int


class ConsistencyIssue(BaseModel):
    type: str
    message: str
    event_ids: list[str] = Field(default_factory=list)
    character_ids: list[str] = Field(default_factory=list)
    severity: str = "warning"


class ConsistencyResponse(BaseModel):
    valid: bool
    branch_id: str
    issues: list[ConsistencyIssue]
    summary: str


# ---------- Routes ----------

@router.get("/")
def list_branches(story_id: str):
    """List all branches for a story."""
    branches = [
        BranchInfo(
            id=b.id,
            story_id=b.story_id,
            name=b.name,
            description=b.description,
            parent_branch_id=b.parent_branch_id,
            divergence_event_id=b.divergence_event_id,
            divergence_sequence=b.divergence_sequence,
            canonical=b.canonical,
        )
        for b in _branches.values()
        if b.story_id == story_id
    ]
    return {"branches": branches}


@router.post("/create", response_model=BranchCreateResponse)
def create_new_branch(request: BranchCreateRequest):
    """Create a What-If branch at a specific divergence point."""
    ws = get_world_state(request.story_id, request.parent_branch_id)
    if ws is None:
        raise HTTPException(404, "World state not found")

    # Find the divergence event
    divergence_event = None
    for event in ws.events.values():
        if event.sequence == request.sequence:
            divergence_event = event
            break

    # Create branch
    branch = create_branch(
        world_state=ws,
        name=f"What If — {request.change[:60]}",
        description=request.change,
        divergence_event_id=divergence_event.id if divergence_event else None,
        divergence_sequence=request.sequence,
    )

    # Clone world state for the branch
    branch_ws = clone_world_state(ws, branch)

    # Identify affected events (events at or after divergence)
    affected_events = [
        e for e in ws.events.values()
        if e.sequence >= request.sequence
    ]

    # Identify affected characters
    affected_char_ids = set()
    for e in affected_events:
        affected_char_ids.update(e.participants)

    # The branch is an independent timeline.  Mark every downstream event as a
    # generated alternate outcome so the UI can render a real second lane and
    # downstream queries cannot silently use canon as if nothing changed.
    downstream_events = sorted(
        (e for e in branch_ws.events.values() if e.sequence > request.sequence),
        key=lambda e: e.sequence,
    )
    alternate_outcomes = _alternate_outcomes(request.change, downstream_events)
    generated_fact_ids: set[str] = set()
    for event in downstream_events:
        event.canonical = False
        event.branch_id = branch.id
        outcome = alternate_outcomes[event.id]
        event.title = outcome["title"]
        event.description = outcome["description"]
        for character_id in event.participants:
            fact_id = f"branch_{branch.id[:8]}_{event.id}_{character_id}"
            branch_ws.knowledge[fact_id] = KnowledgeFact(
                id=fact_id,
                character_id=character_id,
                statement=(
                    f"In this alternate timeline (Premise: {request.change}): "
                    f"{outcome['title']} — {outcome['description']}"
                ),
                valid_from_sequence=event.sequence,
                provenance=Provenance.GENERATED,
                confidence=0.9,
            )
            generated_fact_ids.add(fact_id)

    # Create the explicit divergence event at the selected point.
    consequence_id = f"branch_{branch.id[:8]}_consequence_1"
    consequence_event = Event(
        id=consequence_id,
        story_id=request.story_id,
        title=f"Divergence: {request.change[:80]}",
        description=f"In this alternate timeline: {request.change}",
        sequence=request.sequence,
        event_type=EventType.PLOT,
        participants=list(affected_char_ids)[:5],
        canonical=False,
        branch_id=branch.id,
    )
    branch_ws.add_event(consequence_event)
    branch_ws.current_point.sequence = max(
        (event.sequence for event in branch_ws.events.values()), default=request.sequence
    )
    branch_ws.current_point.label = "Alternate timeline"

    # Save the branch world state
    save_world_state(branch_ws)

    return BranchCreateResponse(
        branch=BranchInfo(
            id=branch.id,
            story_id=branch.story_id,
            name=branch.name,
            description=branch.description,
            parent_branch_id=branch.parent_branch_id,
            divergence_event_id=branch.divergence_event_id,
            divergence_sequence=branch.divergence_sequence,
        ),
        affected_events=len(affected_events),
        affected_characters=list(affected_char_ids),
        consequence_description=request.change,
    )


@router.post("/diverge")
def diverge(request: NarrativeRequest):
    """Legacy diverge endpoint using NarrativeAgent."""
    agent = _get_narrative_agent()
    result = agent.diverge(request)
    return result.model_dump()


@router.get("/{branch_id}")
def get_branch_info(branch_id: str):
    """Get branch details."""
    branch = get_branch(branch_id)
    if branch is None:
        raise HTTPException(404, "Branch not found")
    return BranchInfo(
        id=branch.id,
        story_id=branch.story_id,
        name=branch.name,
        description=branch.description,
        parent_branch_id=branch.parent_branch_id,
        divergence_event_id=branch.divergence_event_id,
        divergence_sequence=branch.divergence_sequence,
        canonical=branch.canonical,
    )


@router.get("/{branch_id}/diff", response_model=BranchDiffResponse)
def get_branch_diff(branch_id: str):
    """Compare a branch against canon."""
    branch = get_branch(branch_id)
    if branch is None:
        raise HTTPException(404, "Branch not found")

    # Get branch world state
    branch_ws = get_world_state(branch.story_id, branch_id)
    if branch_ws is None:
        raise HTTPException(404, "Branch world state not found")

    # Get canon world state
    parent_id = branch.parent_branch_id or "canon"
    canon_ws = get_world_state(branch.story_id, parent_id)
    if canon_ws is None:
        raise HTTPException(404, "Canon world state not found")

    # Compute diff
    canon_events = set(canon_ws.events.keys())
    branch_events = set(branch_ws.events.keys())

    added_ids = branch_events - canon_events
    removed_ids = canon_events - branch_events
    common_ids = canon_events & branch_events

    events_added = []
    for eid in added_ids:
        e = branch_ws.events[eid]
        events_added.append(DiffEntry(
            event_id=eid,
            title=e.title,
            change_type="added",
            branch_description=e.description,
            sequence=e.sequence,
        ))

    events_removed = []
    for eid in removed_ids:
        e = canon_ws.events[eid]
        events_removed.append(DiffEntry(
            event_id=eid,
            title=e.title,
            change_type="removed",
            canon_description=e.description,
            sequence=e.sequence,
        ))

    events_changed = []
    for eid in common_ids:
        ce = canon_ws.events[eid]
        be = branch_ws.events[eid]
        if ce.description != be.description or ce.title != be.title:
            events_changed.append(DiffEntry(
                event_id=eid,
                title=be.title,
                change_type="changed",
                canon_description=ce.description,
                branch_description=be.description,
                sequence=be.sequence,
            ))

    # Characters affected
    affected_chars = set()
    for e in events_added + events_changed:
        be = branch_ws.events.get(e.event_id)
        if be and hasattr(be, 'participants'):
            affected_chars.update(be.participants)

    # Relationships changed
    canon_rels = set(canon_ws.relationships.keys())
    branch_rels = set(branch_ws.relationships.keys())
    rel_changes = len(canon_rels.symmetric_difference(branch_rels))

    # Ripple depth: how many events after divergence are affected
    ripple = len(events_added) + len(events_changed)

    total = len(events_added) + len(events_removed) + len(events_changed)

    return BranchDiffResponse(
        branch_id=branch_id,
        canon_branch_id=parent_id,
        events_added=events_added,
        events_removed=events_removed,
        events_changed=events_changed,
        characters_affected=list(affected_chars),
        relationships_changed=rel_changes,
        ripple_depth=ripple,
        total_changes=total,
    )


@router.post("/{branch_id}/validate", response_model=ConsistencyResponse)
def validate_branch(branch_id: str):
    """Run consistency checks on a branch."""
    branch = get_branch(branch_id)
    if branch is None:
        raise HTTPException(404, "Branch not found")

    branch_ws = get_world_state(branch.story_id, branch_id)
    if branch_ws is None:
        raise HTTPException(404, "Branch world state not found")

    from agents.consistency import ConsistencyAgent
    agent = ConsistencyAgent()
    result = agent.validate(branch_ws)

    issues = []
    if result.metadata and "consistency" in result.metadata:
        cons = result.metadata["consistency"]
        for c in cons.get("contradictions", []):
            issues.append(ConsistencyIssue(
                type=c.get("type", "unknown"),
                message=c.get("message", ""),
                event_ids=c.get("event_ids", []),
                character_ids=c.get("character_ids", []),
                severity=c.get("severity", "warning"),
            ))

    return ConsistencyResponse(
        valid=result.success,
        branch_id=branch_id,
        issues=issues,
        summary=result.output,
    )
