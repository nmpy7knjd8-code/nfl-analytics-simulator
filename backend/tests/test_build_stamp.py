"""mining/build_stamp.py (QA Q8): builtAt is a real, deterministic build date; dataThrough is the last game date."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("build_stamp", ROOT / "mining/build_stamp.py")
st = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(st)


def test_same_content_keeps_committed_builtAt(monkeypatch):
    monkeypatch.setenv("SOURCE_DATE_EPOCH", "1800000000")
    old = {"schema": "x/v1", "builtAt": "2026-10-28", "dataThrough": "2026-02-08", "v": [1]}
    new = {"schema": "x/v1", "builtAt": "", "dataThrough": "2026-02-08", "v": [1]}
    assert st.stamp(new, old) == old


def test_changed_content_gets_build_date(monkeypatch):
    monkeypatch.setenv("SOURCE_DATE_EPOCH", "1800000000")  # 2027-01-15 UTC
    old = {"schema": "x/v1", "builtAt": "2026-10-28", "dataThrough": "2026-02-08", "v": [1]}
    new = {"schema": "x/v1", "builtAt": "", "dataThrough": "2027-01-10", "v": [2]}
    out = st.stamp(new, old)
    assert out["builtAt"] == "2027-01-15" and list(out) == list(new)


def test_site_files_have_both_dates():
    for f in ("fg_rates", "era", "calib"):
        d = json.loads((ROOT / f"data/site/{f}.json").read_text())
        assert d["builtAt"] >= d["dataThrough"], f
