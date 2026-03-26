from __future__ import annotations

import re

COUNTRY_ALIASES = {
    "usa": "USA",
    "us": "USA",
    "united states": "USA",
    "uk": "UK",
    "united kingdom": "UK",
    "uae": "UAE",
}

NOISE_TERMS = {
    "remote",
    "worldwide",
    "global",
    "earth",
    "planet earth",
    "internet",
    "online",
}


def normalize_location(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        return ""
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"\s*,\s*", ", ", value).strip(" ,")
    lowered = value.lower()
    if lowered in NOISE_TERMS:
        return ""
    return COUNTRY_ALIASES.get(lowered, value)
