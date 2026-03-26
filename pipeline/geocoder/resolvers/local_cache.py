from ..types import Coordinates, GeocodedLocation
from .base import Resolver, ResolverContext


LOCAL_CACHE: dict[str, tuple[float, float]] = {
    "USA": (37.0902, -95.7129),
    "UK": (51.5074, -0.1278),
    "India": (20.5937, 78.9629),
    "Germany": (51.1657, 10.4515),
    "France": (46.2276, 2.2137),
}


class LocalCacheResolver(Resolver):
    def resolve(self, context: ResolverContext) -> GeocodedLocation | None:
        if context.original_string not in LOCAL_CACHE:
            return None
        lat, lng = LOCAL_CACHE[context.original_string]
        return GeocodedLocation(
            id=context.identifier,
            originalString=context.original_string,
            resolvedName=context.original_string,
            coords=Coordinates(lat=lat, lng=lng),
            confidence="EXACT",
            source="local_cache",
        )
