from ..types import Coordinates, GeocodedLocation
from .base import Resolver, ResolverContext


class OfflineRulesResolver:
    def resolve(self, context: ResolverContext) -> GeocodedLocation | None:
        if not context.original_string:
            return None
        if context.lat is None or context.lng is None:
            return None
        if context.lat == 0 and context.lng == 0:
            return None
        return GeocodedLocation(
            id=context.identifier,
            originalString=context.original_string,
            resolvedName=context.original_string,
            coords=Coordinates(lat=context.lat, lng=context.lng),
            confidence="HIGH",
            source="offline_rules",
        )
