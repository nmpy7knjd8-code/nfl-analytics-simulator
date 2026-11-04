import importlib.util, shutil
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("workflow_guard", ROOT / "scripts/ci/workflow_guard.py")
guard = importlib.util.module_from_spec(spec); spec.loader.exec_module(guard)

def test_repo_workflows_pass():
    assert guard.main(str(ROOT / ".github/workflows")) == 0

@pytest.mark.parametrize("bad", [
    "permissions:\n  pull-requests: write\n",
    "jobs:\n  a:\n    permissions: { contents: read, pull-requests: write }\n",
    "permissions: write-all\n",
    "jobs:\n  a:\n    steps:\n      - run: gh pr merge 1 --squash\n",
    "jobs:\n  a:\n    steps:\n      - run: gh pr merge --auto --squash\n",
    "jobs:\n  a:\n    steps:\n      - run: gh pr review 5 --approve\n",
    "jobs:\n  a:\n    steps:\n      - uses: pascalgn/automerge-action@v0.16\n",
])
def test_bad_workflow_fails(tmp_path, bad):
    for f in (ROOT / ".github/workflows").glob("*.yml"):
        shutil.copy(f, tmp_path)
    (tmp_path / "bad.yml").write_text("name: bad\non: push\n" + bad)
    assert guard.main(str(tmp_path)) == 1

def test_snapshot_workflow_may_not_merge(tmp_path):
    for f in (ROOT / ".github/workflows").glob("*.yml"):
        shutil.copy(f, tmp_path)
    p = tmp_path / "daily-snapshot.yml"; p.write_text(p.read_text() + "      - run: gh pr merge --squash\n")
    assert guard.main(str(tmp_path)) == 1
