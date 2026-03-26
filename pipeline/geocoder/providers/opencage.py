from __future__ import annotations

from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen
import json
import time

from ..config import GeocoderConfig
from ..types import Coordinates, ExternalLookupResult


class OpenCageClient:
    def __init__(self, config: GeocoderConfig) -> None:
        self.config = config

    def lookup(self, query: str) -> ExternalLookupResult:
        encoded = urlencode(
            {
                "q": query,
                "key": self.config.api_key,
                "limit": 1,
                "no_annotations": 1,
            }
        )
        url = f"https://api.opencagedata.com/geocode/v1/json?{encoded}"
        attempt = 0
        while True:
            try:
                with urlopen(url, timeout=self.config.timeout_seconds) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                return self._parse(query, payload)
            except HTTPError as exc:
                if exc.code == 402:
                    return ExternalLookupResult(
                        provider="opencage",
                        query=query,
                        resolvedName=None,
                        coords=None,
                        confidence="UNKNOWN",
                        error="quota_exceeded",
                    )
                if exc.code == 429 and attempt < self.config.max_retries:
                    time.sleep((self.config.rate_limit_ms / 1000) * (attempt + 1))
                    attempt += 1
                    continue
                return ExternalLookupResult(
                    provider="opencage",
                    query=query,
                    resolvedName=None,
                    coords=None,
                    confidence="UNKNOWN",
                    error=f"http_{exc.code}",
                )
            except URLError:
                if attempt < self.config.max_retries:
                    time.sleep((self.config.rate_limit_ms / 1000) * (attempt + 1))
                    attempt += 1
                    continue
                return ExternalLookupResult(
                    provider="opencage",
                    query=query,
                    resolvedName=None,
                    coords=None,
                    confidence="UNKNOWN",
                    error="network_error",
                )

    def _parse(self, query: str, payload: dict) -> ExternalLookupResult:
        results = payload.get("results") or []
        if not results:
            return ExternalLookupResult(
                provider="opencage",
                query=query,
                resolvedName=None,
                coords=None,
                confidence="UNKNOWN",
                error="no_match",
            )
        item = results[0]
        geometry = item.get("geometry") or {}
        components = item.get("components") or {}
        confidence_score = float(item.get("confidence", 0))
        if confidence_score >= 9:
            confidence = "HIGH"
        elif confidence_score >= 7:
            confidence = "MEDIUM"
        elif confidence_score >= 4:
            confidence = "LOW"
        else:
            confidence = "LOW" if "lat" in geometry and "lng" in geometry else "UNKNOWN"
        resolved_name = item.get("formatted") or components.get("city") or components.get("country")
        coords = None
        if "lat" in geometry and "lng" in geometry:
            coords = Coordinates(lat=float(geometry["lat"]), lng=float(geometry["lng"]))
        return ExternalLookupResult(
            provider="opencage",
            query=query,
            resolvedName=resolved_name,
            coords=coords,
            confidence=confidence,
            error=None if coords else "missing_geometry",
        )
