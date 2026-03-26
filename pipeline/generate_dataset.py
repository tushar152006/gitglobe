from geocoder.engine import GeocodingEngine
from geocoder.types import GeocodingDataset, GeocodedLocation
from pathlib import Path
import json
from datetime import datetime, UTC
import os


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_PATH = ROOT / "public" / "data" / "repos.json"
DEFAULT_OUTPUT_PATH = ROOT / "public" / "data" / "geodata.json"


def resolve_path(env_name: str, fallback: Path) -> Path:
    raw = os.getenv(env_name, "").strip()
    if not raw:
        return fallback
    path = Path(raw)
    if not path.is_absolute():
        path = ROOT / path
    return path


def load_inputs(input_path: Path) -> list[dict]:
    return json.loads(input_path.read_text(encoding="utf-8"))


def build_dataset(input_path: Path) -> GeocodingDataset:
    engine = GeocodingEngine()
    repos = load_inputs(input_path)
    locations: list[GeocodedLocation] = []

    for repo in repos:
      result = engine.resolve(
        identifier=repo["name"],
        original_string=repo.get("loc", ""),
        lat=repo.get("lat"),
        lng=repo.get("lng"),
      )
      locations.append(result)

    source_counts: dict[str, int] = {}
    for item in locations:
        source_counts[item.source] = source_counts.get(item.source, 0) + 1

    resolved = sum(1 for item in locations if item.coords is not None)
    unknown = sum(1 for item in locations if item.confidence == "UNKNOWN")
    return GeocodingDataset(
      version="1.0.0",
      generatedAt=datetime.now(UTC).isoformat(),
      locations=locations,
      summary={
        "total": len(locations),
        "resolved": resolved,
        "unknown": unknown,
        "local_cache": source_counts.get("local_cache", 0),
        "offline_rules": source_counts.get("offline_rules", 0),
        "external_api": source_counts.get("external_api", 0),
        "fallback": source_counts.get("fallback", 0),
        "external_cache_hits": engine.external_resolver.stats["cache_hits"],
        "external_requests": engine.external_resolver.stats["external_requests"],
        "external_failures": engine.external_resolver.stats["failures"],
      },
    )


def main() -> None:
    input_path = resolve_path("GEOCODER_INPUT_PATH", DEFAULT_INPUT_PATH)
    output_path = resolve_path("GEOCODER_OUTPUT_PATH", DEFAULT_OUTPUT_PATH)
    dataset = build_dataset(input_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(dataset.model_dump_json(indent=2), encoding="utf-8")
    print(f"Input: {input_path}")
    print(f"Wrote {output_path}")
    print("Summary:")
    for key, value in dataset.summary.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
