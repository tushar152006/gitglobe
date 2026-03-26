from __future__ import annotations

from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipeline.dependencies.models import DependencyGraphEdge, DependencyRecord, ManifestInputFile, ManifestRepoInput
from pipeline.dependencies.parsers import parse_cargo_toml, parse_package_json, parse_requirements_txt

REPO_DATA_PATH = ROOT / "public" / "data" / "repos.json"
MANIFEST_INPUT_PATH = ROOT / "pipeline" / "dependencies" / "input" / "manifests.json"
RECORDS_OUTPUT_PATH = ROOT / "public" / "data" / "dependency_manifest_records.json"
GRAPH_OUTPUT_PATH = ROOT / "public" / "data" / "dependency_manifest_graph.json"


def load_repo_coords() -> dict[str, list[float]]:
    repos = json.loads(REPO_DATA_PATH.read_text(encoding="utf-8"))
    return {
        repo["name"]: [float(repo["lng"]), float(repo["lat"])]
        for repo in repos
        if repo.get("lat") is not None and repo.get("lng") is not None
    }


def load_manifest_inputs() -> list[ManifestRepoInput]:
    payload = json.loads(MANIFEST_INPUT_PATH.read_text(encoding="utf-8"))
    return [
        ManifestRepoInput(
            repo_id=item["repo_id"],
            files=[ManifestInputFile(path=file["path"], content=file["content"]) for file in item["files"]],
        )
        for item in payload
    ]


def parse_manifest_file(repo_id: str, manifest: ManifestInputFile) -> list[DependencyRecord]:
    lower_path = manifest.path.lower()
    if lower_path.endswith("package.json"):
        return parse_package_json(repo_id, manifest.path, manifest.content)
    if lower_path.endswith("requirements.txt"):
        return parse_requirements_txt(repo_id, manifest.path, manifest.content)
    if lower_path.endswith("cargo.toml"):
        return parse_cargo_toml(repo_id, manifest.path, manifest.content)
    return []


def build_records() -> list[DependencyRecord]:
    records: list[DependencyRecord] = []
    for repo in load_manifest_inputs():
        for manifest in repo.files:
            records.extend(parse_manifest_file(repo.repo_id, manifest))
    deduped = {}
    for record in records:
        key = (
            record.repo_id,
            record.ecosystem,
            record.package_name,
            record.version_spec,
            record.source_file,
            record.is_dev_dependency,
        )
        deduped[key] = record
    return list(deduped.values())


def build_graph(records: list[DependencyRecord]) -> list[DependencyGraphEdge]:
    coords = load_repo_coords()
    repo_packages: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for record in records:
        repo_packages[record.repo_id][record.ecosystem].add(record.package_name)

    edges: list[DependencyGraphEdge] = []
    repo_ids = sorted(repo_packages.keys())
    for source_repo, target_repo in combinations(repo_ids, 2):
        if source_repo not in coords or target_repo not in coords:
            continue
        shared_by_ecosystem: dict[str, set[str]] = {}
        for ecosystem in set(repo_packages[source_repo]) | set(repo_packages[target_repo]):
            shared = repo_packages[source_repo].get(ecosystem, set()) & repo_packages[target_repo].get(ecosystem, set())
            if shared:
                shared_by_ecosystem[ecosystem] = shared
        if not shared_by_ecosystem:
            continue

        ecosystem, shared_packages = max(shared_by_ecosystem.items(), key=lambda item: len(item[1]))
        union = repo_packages[source_repo][ecosystem] | repo_packages[target_repo][ecosystem]
        weight = len(shared_packages) / len(union)
        top_packages = sorted(shared_packages)[:4]
        edges.append(
            DependencyGraphEdge(
                source_repo=source_repo,
                target_repo=target_repo,
                source_coords=coords[source_repo],
                target_coords=coords[target_repo],
                weight=round(weight, 3),
                rationale=f"Shared manifest deps: {', '.join(top_packages)}",
                ecosystem=ecosystem,
                data_source="manifest",
                shared_packages=top_packages,
            )
        )
    return sorted(edges, key=lambda item: item.weight, reverse=True)[:30]


def main() -> None:
    records = build_records()
    graph = build_graph(records)
    RECORDS_OUTPUT_PATH.write_text(json.dumps([record.to_dict() for record in records], indent=2), encoding="utf-8")
    GRAPH_OUTPUT_PATH.write_text(json.dumps([edge.to_dict() for edge in graph], indent=2), encoding="utf-8")

    ecosystem_counts = Counter(record.ecosystem for record in records)
    print(f"Wrote {RECORDS_OUTPUT_PATH}")
    print(f"Wrote {GRAPH_OUTPUT_PATH}")
    print("Summary:")
    print(f"  repos_with_manifests: {len({record.repo_id for record in records})}")
    print(f"  dependency_records: {len(records)}")
    print(f"  graph_edges: {len(graph)}")
    for ecosystem, count in sorted(ecosystem_counts.items()):
        print(f"  ecosystem_{ecosystem}: {count}")


if __name__ == "__main__":
    main()
