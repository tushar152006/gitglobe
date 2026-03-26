from __future__ import annotations

import time

from .base import Resolver, ResolverContext
from ..cache import GeocodeCache
from ..config import load_config
from ..providers import OpenCageClient
from ..types import GeocodedLocation


class ExternalApiResolver(Resolver):
    def __init__(self) -> None:
        self.config = load_config()
        self.cache = GeocodeCache()
        self.client = OpenCageClient(self.config) if self.config.provider == "opencage" and self.config.api_key else None
        self.stats = {
            "cache_hits": 0,
            "external_requests": 0,
            "resolved": 0,
            "failures": 0,
            "skipped": 0,
        }

    def resolve(self, context: ResolverContext) -> GeocodedLocation | None:
        query = context.original_string.strip()
        if not query:
            self.stats["skipped"] += 1
            return None
        if not self.config.enabled or not self.client:
            self.stats["skipped"] += 1
            return None

        cached = self.cache.get(query)
        if cached is not None:
            self.stats["cache_hits"] += 1
            if cached.coords is None:
                self.stats["failures"] += 1
                return None
            self.stats["resolved"] += 1
            return GeocodedLocation(
                id=context.identifier,
                originalString=context.original_string,
                resolvedName=cached.resolvedName,
                coords=cached.coords,
                confidence=cached.confidence,
                source="external_api",
            )

        self.stats["external_requests"] += 1
        result = self.client.lookup(query)
        self.cache.set(query, result)
        time.sleep(self.config.rate_limit_ms / 1000)

        if result.coords is None:
            self.stats["failures"] += 1
            return None

        self.stats["resolved"] += 1
        return GeocodedLocation(
            id=context.identifier,
            originalString=context.original_string,
            resolvedName=result.resolvedName,
            coords=result.coords,
            confidence=result.confidence,
            source="external_api",
        )
