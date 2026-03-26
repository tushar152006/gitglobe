from __future__ import annotations

import tomllib

from ..models import DependencyRecord


def parse_cargo_toml(repo_id: str, path: str, content: str) -> list[DependencyRecord]:
    payload = tomllib.loads(content)
    records: list[DependencyRecord] = []
    for section, is_dev in (("dependencies", False), ("dev-dependencies", True)):
        deps = payload.get(section) or {}
        for package_name, definition in deps.items():
            if isinstance(definition, str):
                version_spec = definition
            elif isinstance(definition, dict):
                version_spec = str(definition.get("version", "*"))
            else:
                version_spec = "*"
            records.append(
                DependencyRecord(
                    repo_id=repo_id,
                    ecosystem="cargo",
                    package_name=package_name,
                    version_spec=version_spec,
                    dependency_type="direct",
                    source_file=path,
                    is_dev_dependency=is_dev,
                )
            )
    return records
