from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class ManifestInputFile:
    path: str
    content: str


@dataclass
class ManifestRepoInput:
    repo_id: str
    files: list[ManifestInputFile]


@dataclass
class DependencyRecord:
    repo_id: str
    ecosystem: str
    package_name: str
    version_spec: str
    dependency_type: str
    source_file: str
    is_dev_dependency: bool

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class DependencyGraphEdge:
    source_repo: str
    target_repo: str
    source_coords: list[float]
    target_coords: list[float]
    weight: float
    rationale: str
    ecosystem: str
    data_source: str
    shared_packages: list[str]

    def to_dict(self) -> dict:
        return asdict(self)
