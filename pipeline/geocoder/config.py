from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class GeocoderConfig:
    provider: str = "opencage"
    api_key: str = ""
    enabled: bool = False
    timeout_seconds: float = 8.0
    rate_limit_ms: int = 250
    max_retries: int = 2


def load_config() -> GeocoderConfig:
    _load_dotenv()
    return GeocoderConfig(
        provider=os.getenv("GEOCODER_PROVIDER", "opencage").strip().lower(),
        api_key=os.getenv("GEOCODER_API_KEY", "").strip(),
        enabled=os.getenv("GEOCODER_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"},
        timeout_seconds=float(os.getenv("GEOCODER_TIMEOUT_SECONDS", "8")),
        rate_limit_ms=int(os.getenv("GEOCODER_RATE_LIMIT_MS", "250")),
        max_retries=int(os.getenv("GEOCODER_MAX_RETRIES", "2")),
    )
