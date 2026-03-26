from __future__ import annotations

import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
REPOS_PATH = ROOT / "public" / "data" / "repos.json"
OUT_GEO = ROOT / "public" / "data" / "geo_intelligence.json"
OUT_DEP = ROOT / "public" / "data" / "dependency_graph.json"

REGIONS = {
    "North America": {"latMin": 24, "latMax": 72, "lngMin": -168, "lngMax": -52},
    "Europe": {"latMin": 35, "latMax": 72, "lngMin": -12, "lngMax": 45},
    "Asia": {"latMin": 5, "latMax": 55, "lngMin": 45, "lngMax": 150},
    "South America": {"latMin": -56, "latMax": 13, "lngMin": -82, "lngMax": -34},
    "Oceania": {"latMin": -47, "latMax": -10, "lngMin": 110, "lngMax": 180},
    "Africa": {"latMin": -35, "latMax": 38, "lngMin": -18, "lngMax": 52},
}


def repo_region(repo: dict) -> str:
    for name, region in REGIONS.items():
        if region["latMin"] <= repo["lat"] <= region["latMax"] and region["lngMin"] <= repo["lng"] <= region["lngMax"]:
            return name
    return "Other"


def confidence(repo: dict) -> tuple[float, str, bool]:
    loc = (repo.get("loc") or "").strip()
    if not loc or loc.lower() in {"unknown", "n/a"} or (repo["lat"] == 0 and repo["lng"] == 0):
        return 0.15, "unknown", True
    if "," in loc:
        return 0.94, "profile", False
    if len(loc) <= 3:
        return 0.72, "derived", False
    return 0.84, "org", False


def overlap(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / max(len(a), len(b))


def build_geo(repos: list[dict]) -> list[dict]:
    geo = []
    for repo in repos:
        score, source, unknown = confidence(repo)
        geo.append({
            "repo_id": repo["name"],
            "country": (repo.get("loc") or "Unknown").split(",")[-1].strip() or "Unknown",
            "region": repo_region(repo),
            "geocode_confidence": round(score, 3),
            "location_source": source,
            "is_unknown_origin": unknown,
        })
    return geo


def build_dependency_graph(repos: list[dict]) -> list[dict]:
    links: list[dict] = []
    by_lang: defaultdict[str, list[dict]] = defaultdict(list)
    for repo in repos:
        by_lang[repo["lang"]].append(repo)

    for lang_repos in by_lang.values():
        scoped = sorted(lang_repos, key=lambda x: x["stars"], reverse=True)[:24]
        for i, source in enumerate(scoped):
            s_topics = set(filter(None, source.get("topics", "").split(",")))
            for target in scoped[i + 1:]:
                t_topics = set(filter(None, target.get("topics", "").split(",")))
                topic_score = overlap(s_topics, t_topics)
                if topic_score <= 0:
                    continue
                weight = min(0.98, 0.45 + topic_score * 0.35 + min(source["stars"], target["stars"]) / max(source["stars"], target["stars"], 1) * 0.2)
                if weight < 0.62:
                    continue
                shared = ", ".join(sorted((s_topics & t_topics))[:2]) or source["lang"]
                links.append({
                    "source_repo": source["name"],
                    "target_repo": target["name"],
                    "source_coords": [source["lng"], source["lat"]],
                    "target_coords": [target["lng"], target["lat"]],
                    "weight": round(weight, 3),
                    "rationale": f"Shared ecosystem: {shared}",
                })

    links.sort(key=lambda item: item["weight"], reverse=True)
    return links[:120]


def main() -> None:
    repos = json.loads(REPOS_PATH.read_text(encoding="utf-8"))
    OUT_GEO.write_text(json.dumps(build_geo(repos), indent=2), encoding="utf-8")
    OUT_DEP.write_text(json.dumps(build_dependency_graph(repos), indent=2), encoding="utf-8")
    print(f"Wrote {OUT_GEO}")
    print(f"Wrote {OUT_DEP}")


if __name__ == "__main__":
    main()
