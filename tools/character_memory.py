from core.world import KnowledgeFact, Provenance, WorldState


def get_character_knowledge(
    world_state: WorldState,
    character_id: str,
    sequence: int | None = None,
) -> list[KnowledgeFact]:
    """Return timeline-bounded memory, backfilling it for older uploads."""
    effective_sequence = sequence if sequence is not None and sequence > 0 else world_state.current_point.sequence
    facts = world_state.get_known_facts(character_id, effective_sequence)
    if facts:
        return facts

    character = world_state.get_character(character_id)
    if character is None:
        return []

    aliases = {character_id, character.name.lower(), *(alias.lower() for alias in character.aliases)}
    relevant_events = []
    for event in world_state.events.values():
        event_text = f"{event.title} {event.description}".lower()
        is_participant = character_id in event.participants
        is_named = any(alias and alias in event_text for alias in aliases)
        if event.sequence <= effective_sequence and (is_participant or is_named):
            relevant_events.append(event)

    # Some imported stories have no participant metadata. In that case give the
    # selected character the visible timeline context instead of an empty chat.
    if not relevant_events:
        relevant_events = [
            event for event in world_state.events.values()
            if event.sequence <= effective_sequence
        ]

    for event in relevant_events:
        fact_id = f"derived_{event.id}_{character_id}"
        if fact_id not in world_state.knowledge:
            world_state.knowledge[fact_id] = KnowledgeFact(
                id=fact_id,
                character_id=character_id,
                statement=f"{event.title}: {event.description}",
                valid_from_sequence=event.sequence,
                provenance=Provenance.CANON if event.canonical else Provenance.GENERATED,
                confidence=0.85,
            )

    return world_state.get_known_facts(character_id, effective_sequence)


def remember_fact(
    world_state: WorldState,
    fact: KnowledgeFact,
) -> None:
    world_state.knowledge[fact.id] = fact
