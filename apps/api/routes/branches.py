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


def _extract_text_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict):
                parts.append(part.get("text", ""))
            else:
                parts.append(str(part))
        return "".join(parts)
    return str(content)


def _alternate_outcomes(change: str, events: list[Event]) -> dict[str, dict[str, str]]:
    """Generate a distinct downstream story based strictly on the user's What-If hypothesis."""
    if not events:
        return {}
    
    fallback = {
        event.id: {
            "title": event.title,
            "description": event.description,
        }
        for event in events
    }
    
    try:
        from config.llm import get_llm
        llm = get_llm()
        source = "\n".join(
            f"ID: {event.id} | Sequence: {event.sequence} | Original Title: {event.title} | Original Beat: {event.description}"
            for event in events[:12]
        )
        
        prompt = (
            f"You are a master story author and narrative architect.\n\n"
            f"WHAT-IF PREMISE / TIMELINE DIVERGENCE:\n"
            f"\"{change}\"\n\n"
            f"ORIGINAL STORY EVENTS:\n{source}\n\n"
            f"TASK:\n"
            f"Rewrite each story event listed above into a new, original, creative story beat that logically and dynamically follows from the WHAT-IF PREMISE.\n"
            f"Do NOT write meta-commentary like 'As a consequence of the premise...' or 'This unfolds differently...'.\n"
            f"Instead, WRITE THE ACTUAL ALTERNATE STORY itself! Describe what the characters do, what happens next, and how the plot develops differently.\n\n"
            f"FORMAT REQUIREMENT:\n"
            f"Return ONLY a valid JSON array of objects with double quotes for all keys and values. Example:\n"
            f"[\n"
            f"  {{\n"
            f"    \"id\": \"event_id_here\",\n"
            f"    \"title\": \"Vivid New Event Title\",\n"
            f"    \"description\": \"Detailed description of what happens in this alternate story beat.\"\n"
            f"  }}\n"
            f"]"
        )
        
        response = llm.invoke(prompt)
        content = _extract_text_content(response.content)
        
        # Clean markdown wrappers if present
        content = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.MULTILINE)
        content = re.sub(r"\s*```$", "", content, flags=re.MULTILINE)
        content = content.strip()
        
        match = re.search(r"\[\s*\{.*\}\s*\]", content, re.DOTALL)
        if match:
            raw_json = match.group(0)
            try:
                generated = json.loads(raw_json)
            except json.JSONDecodeError:
                sanitized = re.sub(r"'([^']*)'", r'"\1"', raw_json)
                generated = json.loads(sanitized)

            for item in generated:
                event_id = item.get("id")
                if event_id in fallback and item.get("description"):
                    fallback[event_id] = {
                        "title": str(item.get("title") or fallback[event_id]["title"])[:120],
                        "description": str(item["description"])[:1000],
                    }
    except Exception as exc:
        logger.warning("Alternate story generation fell back to local narrative: %s", exc)
        
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

    # Purge old canon knowledge facts for rewritten sequence points (>= request.sequence)
    # so characters in this branch do not retain conflicting canon memories.
    stale_fact_keys = [
        k for k, fact in list(branch_ws.knowledge.items())
        if fact.valid_from_sequence >= request.sequence
    ]
    for k in stale_fact_keys:
        del branch_ws.knowledge[k]

    # Identify affected events (events at or after divergence)
    affected_events = [
        e for e in ws.events.values()
        if e.sequence >= request.sequence
    ]

    # Identify affected characters
    affected_char_ids = set()
    for e in affected_events:
        affected_char_ids.update(e.participants)

    # The branch is an independent timeline. Mark every downstream event as a
    # generated alternate outcome so the UI can render a real second lane.
    downstream_events = sorted(
        (e for e in branch_ws.events.values() if e.sequence >= request.sequence),
        key=lambda e: e.sequence,
    )
    alternate_outcomes = _alternate_outcomes(request.change, downstream_events)
    generated_fact_ids: set[str] = set()
    for event in downstream_events:
        event.canonical = False
        event.branch_id = branch.id
        if event.id in alternate_outcomes:
            outcome = alternate_outcomes[event.id]
            event.title = outcome["title"]
            event.description = outcome["description"]
            target_chars = event.participants if event.participants else list(branch_ws.characters.keys())
            for character_id in target_chars:
                fact_id = f"branch_{branch.id[:8]}_{event.id}_{character_id}"
                branch_ws.knowledge[fact_id] = KnowledgeFact(
                    id=fact_id,
                    character_id=character_id,
                    statement=f"{outcome['title']}: {outcome['description']}",
                    valid_from_sequence=event.sequence,
                    provenance=Provenance.GENERATED,
                    confidence=0.9,
                )
                generated_fact_ids.add(fact_id)

    # Create the explicit divergence event at the selected point if needed
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

    branch_ws = get_world_state(branch.story_id, branch_id)
    if branch_ws is None:
        raise HTTPException(404, "Branch world state not found")

    parent_id = branch.parent_branch_id or "canon"
    canon_ws = get_world_state(branch.story_id, parent_id)
    if canon_ws is None:
        raise HTTPException(404, "Canon world state not found")

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

    affected_chars = set()
    for e in events_added + events_changed:
        be = branch_ws.events.get(e.event_id)
        if be and hasattr(be, 'participants'):
            affected_chars.update(be.participants)

    canon_rels = set(canon_ws.relationships.keys())
    branch_rels = set(branch_ws.relationships.keys())
    rel_changes = len(canon_rels.symmetric_difference(branch_rels))

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
