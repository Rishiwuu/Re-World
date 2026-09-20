from __future__ import annotations

import logging
import os
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from core.world import (
    KnowledgeFact,
    Provenance,
    StoryPoint,
    WorldState,
)
from ingestion.normalization import normalize_text
from ingestion.extraction import (
    extract_characters,
    extract_events,
    extract_relationships,
    extract_timeline,
)
from tools.world_state import get_world_state, save_world_state
from tools.story_search import add_story_document

logger = logging.getLogger("reworld")

router = APIRouter(prefix="/stories", tags=["stories"])


# ---------- Schemas ----------

class StoryListItem(BaseModel):
    id: str
    title: str
    description: str = ""


class StoryListResponse(BaseModel):
    stories: list[StoryListItem]


class StoryCreateRequest(BaseModel):
    title: str
    raw_text: str
    description: str = ""


class IngestionProgress(BaseModel):
    step: str
    detail: str = ""


class StoryCreateResponse(BaseModel):
    story_id: str
    title: str
    characters: int
    events: int
    relationships: int
    timeline_points: int


# ---------- Routes ----------

@router.get("/", response_model=StoryListResponse)
def list_stories():
    """List all available story worlds."""
    from tools.world_state import _world_states

    stories = []
    seen = set()
    for key, ws in _world_states.items():
        sid = ws.story_id
        if sid not in seen:
            seen.add(sid)
            stories.append(StoryListItem(
                id=sid,
                title=sid.replace("_", " ").replace("-", " ").title(),
                description=f"World with {len(ws.characters)} characters and {len(ws.events)} events",
            ))
    return StoryListResponse(stories=stories)


@router.get("/{story_id}")
def get_story(story_id: str):
    """Get story details."""
    ws = get_world_state(story_id, "canon")
    if ws is None:
        raise HTTPException(404, f"Story '{story_id}' not found")

    return {
        "story_id": ws.story_id,
        "branch_id": ws.branch_id,
        "characters": len(ws.characters),
        "events": len(ws.events),
        "relationships": len(ws.relationships),
        "knowledge_facts": len(ws.knowledge),
        "current_point": ws.current_point.model_dump(),
    }


@router.post("/", response_model=StoryCreateResponse)
def create_story(request: StoryCreateRequest):
    """Create a story from raw text and build its world."""
    story_id = request.title.lower().replace(" ", "_").replace("'", "")[:50]
    story_id = f"{story_id}_{uuid.uuid4().hex[:6]}"

    text = normalize_text(request.raw_text)
    if len(text) < 20:
        raise HTTPException(
            status_code=422,
            detail="The uploaded file does not contain enough readable text. Use a TXT, text-based PDF, or DOCX with story content.",
        )

    # Extract
    characters = extract_characters(text)
    char_ids = [c.id for c in characters]
    events = extract_events(text, story_id, char_ids)
    if not events:
        # A non-empty source must always have an inspectable starting point.
        # This protects the UI from rendering an empty timeline when a source
        # has unusual punctuation or formatting.
        from core.world import Event, EventType
        events = [Event(
            id=f"{story_id}_event_1",
            story_id=story_id,
            title="Opening narrative beat",
            description=text[:600],
            sequence=1,
            event_type=EventType.PLOT,
            participants=char_ids,
        )]
    relationships = extract_relationships(text, char_ids)
    timeline = extract_timeline(text, len(events))

    # Build world state
    char_dict = {c.id: c for c in characters}
    event_dict = {e.id: e for e in events}
    rel_dict = {r.id: r for r in relationships}

    # Generate knowledge facts from events
    knowledge: dict[str, KnowledgeFact] = {}
    for event in events:
        target_chars = event.participants if event.participants else char_ids
        for participant in target_chars:
            fact_id = f"kf_{event.id}_{participant}"
            knowledge[fact_id] = KnowledgeFact(
                id=fact_id,
                character_id=participant,
                statement=f"{event.title}: {event.description[:200]}",
                valid_from_sequence=event.sequence,
                provenance=Provenance.CANON,
            )

    max_seq = max([e.sequence for e in events], default=1)
    current_point = timeline[-1] if timeline else StoryPoint(sequence=max_seq, label="Conclusion")

    ws = WorldState(
        story_id=story_id,
        branch_id="canon",
        current_point=current_point,
        characters=char_dict,
        events=event_dict,
        relationships=rel_dict,
        knowledge=knowledge,
    )
    save_world_state(ws)

    # Index text for search
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    for i, para in enumerate(paragraphs):
        add_story_document(
            source_id=f"{story_id}_chunk_{i}",
            text=para,
            metadata={"story_id": story_id, "chunk_index": i},
        )

    return StoryCreateResponse(
        story_id=story_id,
        title=request.title,
        characters=len(characters),
        events=len(events),
        relationships=len(relationships),
        timeline_points=len(timeline),
    )


@router.post("/upload", response_model=StoryCreateResponse)
async def upload_story(
    file: UploadFile = File(...),
    title: str = Form("Uploaded Story"),
):
    """Upload a file (TXT/PDF/DOCX) and build its world."""
    content = await file.read()

    suffix = os.path.splitext(file.filename or "file.txt")[1].lower()

    if suffix == ".txt":
        text = content.decode("utf-8", errors="replace")
    elif suffix == ".pdf":
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            from ingestion.loaders.pdf import load_pdf
            text = load_pdf(tmp_path)
        finally:
            os.unlink(tmp_path)
    elif suffix == ".docx":
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            from ingestion.loaders.docx import load_docx
            text = load_docx(tmp_path)
        finally:
            os.unlink(tmp_path)
    else:
        # Treat as text
        text = content.decode("utf-8", errors="replace")

    req = StoryCreateRequest(title=title, raw_text=text)
    return create_story(req)
