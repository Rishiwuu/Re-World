from __future__ import annotations

import re
from core.world.timeline import StoryPoint


def extract_timeline(
    text: str,
    event_count: int = 1,
) -> list[StoryPoint]:
    """
    Extract story points corresponding to chronological chapters or sequence beats.
    """
    points: list[StoryPoint] = []

    # Detect common chapter / episode markers.
    pattern = re.compile(
        r"(?im)^(chapter|episode|part|scene)\s+([^\n]+)"
    )

    matches = list(pattern.finditer(text))

    for index, match in enumerate(matches):
        kind = match.group(1).capitalize()
        label = match.group(2).strip()

        points.append(
            StoryPoint(
                sequence=index + 1,
                label=f"{kind} {label}",
                chapter=label if kind == "Chapter" else None,
                episode=label if kind == "Episode" else None,
            )
        )

    if not points:
        count = max(1, event_count)
        for i in range(1, count + 1):
            points.append(
                StoryPoint(
                    sequence=i,
                    label=f"Sequence Point {i}",
                    description=f"Narrative beat {i}",
                )
            )

    return points