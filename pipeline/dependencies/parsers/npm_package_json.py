from __future__ import annotations

import json

from ..models import DependencyRecord


def parse_package_json(repo_id: str, path: str, content: str) -> list[DependencyRecord]:
    payload = json.loads(content)
    records: list[DependencyRecord] = []
    for section, is_dev in (("dependencies", False), ("devDependencies", True), ("peerDependencies", False)):
        deps = payload.get(section) or {}
        for package_name, version_spec in deps.items():
            records.append(
                DependencyRecord(
                    repo_id=repo_id,
                    ecosystem="npm",
                    package_name=package_name,
                    version_spec=str(version_spec),
                    dependency_type="direct",
                    source_file=path,
                    is_dev_dependency=is_dev,
                )
            )
    return records
