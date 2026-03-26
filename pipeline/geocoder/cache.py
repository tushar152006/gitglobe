from __future__ import annotations

from pathlib import Path
import json

from .types import Coordinates, ExternalLookupResult


CACHE_PATH = Path(__file__).resolve().parents[1] / "cache" / "geocode_cache.json"


def _serialize(result: ExternalLookupResult) -> dict:
    data = result.model_dump()
    if result.coords is not None:
        data["coords"] = {"lat": result.coords.lat, "lng": result.coords.lng}
    return data


class GeocodeCache:
    def __init__(self) -> None:
        self.path = CACHE_PATH
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            self._data = json.loads(self.path.read_text(encoding="utf-8"))
        else:
            self._data: dict[str, dict] = {}

    def get(self, query: str) -> ExternalLookupResult | None:
        item = self._data.get(query)
        if not item:
            return None
        coords = item.get("coords")
        return ExternalLookupResult(
            provider=item.get("provider", "opencage"),
            query=query,
            resolvedName=item.get("resolvedName"),
            coords=Coordinates(lat=coords["lat"], lng=coords["lng"]) if coords else None,
            confidence=item.get("confidence", "UNKNOWN"),
            error=item.get("error"),
            cacheHit=True,
        )

    def set(self, query: str, result: ExternalLookupResult) -> None:
        self._data[query] = _serialize(result)
        self.path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")
