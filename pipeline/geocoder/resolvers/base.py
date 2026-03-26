from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from ..types import GeocodedLocation


@dataclass
class ResolverContext:
    identifier: str
    original_string: str
    lat: float | None
    lng: float | None


class Resolver(ABC):
    @abstractmethod
    def resolve(self, context: ResolverContext) -> GeocodedLocation | None:
        raise NotImplementedError
