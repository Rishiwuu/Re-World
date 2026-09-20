from core.world import KnowledgeFact, Provenance, WorldState


def get_character_knowledge(
    world_state: WorldState,
    character_id: str,
    sequence: int | None = None,
) -> list[KnowledgeFact]:
    """Return timeline-bounded memory for a character at a specific sequence point."""
    effective_sequence = sequence if sequence is not None and sequence > 0 else world_state.current_point.sequence

    character = world_state.get_character(character_id)
    aliases = {character_id, character.name.lower(), *(alias.lower() for alias in character.aliases)} if character else {character_id}

    # Find divergence sequence if on a branch
    divergence_seq = None
    if world_state.branch_id != "canon":
        for e in world_state.events.values():
            if not e.canonical and e.sequence > 0:
                if divergence_seq is None or e.sequence < divergence_seq:
                    divergence_seq = e.sequence

    # Derive/ensure facts from world_state.events up to effective_sequence
    for event in world_state.events.values():
        if event.sequence <= effective_sequence:
            event_text = f"{event.title} {event.description}".lower()
            is_participant = character_id in event.participants
            is_named = any(alias and alias in event_text for alias in aliases)
            if not event.participants or is_participant or is_named:
                fact_id = f"evt_fact_{world_state.branch_id[:8]}_{event.id}_{character_id}"
                if fact_id not in world_state.knowledge:
                    world_state.knowledge[fact_id] = KnowledgeFact(
                        id=fact_id,
                        character_id=character_id,
                        statement=f"{event.title}: {event.description}",
                        valid_from_sequence=event.sequence,
                        provenance=Provenance.CANON if event.canonical else Provenance.GENERATED,
                        confidence=0.9,
                    )

    facts = world_state.get_known_facts(character_id, effective_sequence)

    # Filter out canon facts at sequences that were superseded by branch events
    if world_state.branch_id != "canon" and divergence_seq is not None:
        branch_event_sequences = {
            e.sequence for e in world_state.events.values()
            if not e.canonical and e.sequence <= effective_sequence
        }
        filtered_facts = []
        for fact in facts:
            if fact.provenance == Provenance.CANON and fact.valid_from_sequence in branch_event_sequences:
                continue
            filtered_facts.append(fact)
        return filtered_facts

    return facts


def remember_fact(
    world_state: WorldState,
    fact: KnowledgeFact,
) -> None:
    world_state.knowledge[fact.id] = fact
