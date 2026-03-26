from .types import Coordinates, GeocodedLocation
from .utils import normalize_location
from .resolvers.base import ResolverContext
from .resolvers.local_cache import LocalCacheResolver
from .resolvers.offline_rules import OfflineRulesResolver
from .resolvers.external_api import ExternalApiResolver


class GeocodingEngine:
    def __init__(self) -> None:
        self.external_resolver = ExternalApiResolver()
        self.resolvers = [
            LocalCacheResolver(),
            OfflineRulesResolver(),
            self.external_resolver,
        ]

    def resolve(self, identifier: str, original_string: str, lat: float | None, lng: float | None) -> GeocodedLocation:
        context = ResolverContext(
            identifier=identifier,
            original_string=normalize_location(original_string),
            lat=lat,
            lng=lng,
        )
        for resolver in self.resolvers:
            result = resolver.resolve(context)
            if result is not None:
                return result

        coords = None
        if lat is not None and lng is not None and not (lat == 0 and lng == 0):
            coords = Coordinates(lat=lat, lng=lng)

        return GeocodedLocation(
            id=identifier,
            originalString=original_string,
            resolvedName=context.original_string or None,
            coords=coords,
            confidence="LOW" if coords else "UNKNOWN",
            source="fallback",
        )
