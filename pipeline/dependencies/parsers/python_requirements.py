from __future__ import annotations

import re

from ..models import DependencyRecord


VERSION_SPLIT = re.compile(r"(==|>=|<=|~=|!=|>|<)")


def parse_requirements_txt(repo_id: str, path: str, content: str) -> list[DependencyRecord]:
    records: list[DependencyRecord] = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        package_name = VERSION_SPLIT.split(line, 1)[0].strip()
        version_spec = line[len(package_name):].strip()
        if not package_name:
            continue
        records.append(
            DependencyRecord(
                repo_id=repo_id,
                ecosystem="python",
                package_name=package_name.lower(),
                version_spec=version_spec,
                dependency_type="direct",
                source_file=path,
                is_dev_dependency=False,
            )
        )
    return records
