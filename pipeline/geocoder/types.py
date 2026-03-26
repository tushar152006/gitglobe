from typing import Literal
import json

try:
    from pydantic import BaseModel, Field  # type: ignore
except Exception:  # pragma: no cover
    class BaseModel:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)

        def model_dump(self):
            result = {}
            for key, value in self.__dict__.items():
                if isinstance(value, BaseModel):
                    result[key] = value.model_dump()
                elif isinstance(value, list):
                    result[key] = [item.model_dump() if isinstance(item, BaseModel) else item for item in value]
                else:
                    result[key] = value
            return result

        def model_dump_json(self, indent=None):
            return json.dumps(self.model_dump(), indent=indent)

    def Field(default=None, **_kwargs):
        return default


ConfidenceLevel = Literal["EXACT", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]


class Coordinates(BaseModel):
    lat: float
    lng: float


class GeocodedLocation(BaseModel):
    id: str
    originalString: str
    resolvedName: str | None
    coords: Coordinates | None
    confidence: ConfidenceLevel
    source: str


class ExternalLookupResult(BaseModel):
    provider: str
    query: str
    resolvedName: str | None
    coords: Coordinates | None
    confidence: ConfidenceLevel
    error: str | None = None
    cacheHit: bool = False


class GeocodingDataset(BaseModel):
    version: str = Field(default="1.0.0")
    generatedAt: str
    locations: list[GeocodedLocation]
    summary: dict[str, int]
