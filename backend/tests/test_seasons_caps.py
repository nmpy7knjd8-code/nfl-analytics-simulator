"""2026 PR2: one shared season list (mining/seasons.py) and season-aware size caps for every lane output."""
from __future__ import annotations

import glob
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "mining"))
import _frozen as fz  # noqa: E402
import seasons as mining_seasons  # noqa: E402
import nfl_sim.seasons as S  # noqa: E402  (the real definitions; mining/seasons.py re-exports them)


def test_mining_reexports_the_package_list():
    for name in ("FIRST", "CLOSED_THROUGH", "OPEN", "CLOSED", "SEASONS", "CLOSED_SPAN", "SIZE_CAPS"):
        assert getattr(mining_seasons, name) is getattr(S, name), name
    assert mining_seasons.size_cap is S.size_cap


def test_one_contiguous_season_list():
    assert S.CLOSED == tuple(range(S.FIRST, S.CLOSED_THROUGH + 1))
    assert S.SEASONS == S.CLOSED + S.OPEN and list(S.SEASONS) == sorted(set(S.SEASONS))
    assert all(s > S.CLOSED_THROUGH for s in S.OPEN)
    assert list(S.SEASONS) == list(range(S.FIRST, S.SEASONS[-1] + 1))  # no gaps
    assert fz.FROZEN_THROUGH == S.CLOSED_THROUGH  # the guard reads the same list
    assert S.CLOSED_SPAN == [2019, 2025]


def test_watermarks_only_for_open_seasons():
    for name, by in json.loads(fz.WATERMARKS.read_text())["weeks"].items():
        assert all(int(s) in S.OPEN for s in by), name


def test_published_season_files_match_the_list():
    for d in ("data/site/charts", "data/site/drives"):
        assert sorted(int(Path(p).stem) for p in glob.glob(str(ROOT / d / "*.json"))) == list(S.SEASONS), d


def _files(key):
    return [Path(p) for p in glob.glob(str(ROOT / key))]


def test_every_cap_names_existing_files_and_every_file_fits():
    for key in S.SIZE_CAPS:
        files = _files(key)
        assert files, key
        for f in files:
            assert f.stat().st_size < S.size_cap(str(f.relative_to(ROOT))), (f, f.stat().st_size, S.size_cap(key))


def test_caps_leave_room_for_one_more_season(monkeypatch):
    """Projected with one more open season (bytes grow by the average closed-season size per season),
    every growing file still fits its cap; per-season files are one season like the largest closed one."""
    n = len(S.SEASONS)
    monkeypatch.setattr(S, "OPEN", S.OPEN + (S.SEASONS[-1] + 1,))
    for key, (_, per_open) in S.SIZE_CAPS.items():
        biggest = max(f.stat().st_size for f in _files(key))
        projected = biggest * (n + 1) / n if per_open else biggest
        assert projected < S.size_cap(key), (key, int(projected), S.size_cap(key))
    for key in ("data/site/onthisday.json", "data/site/drives/*.json", "data/site/charts/*.json"):
        assert max(f.stat().st_size for f in _files(key)) < 0.9 * S.size_cap(key), key  # >= 10% headroom


def test_cap_grows_by_fixed_allowance_per_open_season(monkeypatch):
    base = S.size_cap("data/site/onthisday.json")
    monkeypatch.setattr(S, "OPEN", (2026,))
    assert S.size_cap("data/site/onthisday.json") == base + S.SIZE_CAPS["data/site/onthisday.json"][1]
    assert S.size_cap("data/site/drives/2026.json") == S.SIZE_CAPS["data/site/drives/*.json"][0]


def test_pbp_paths_follow_the_list(tmp_path):
    for s in S.SEASONS:
        (tmp_path / f"pbp_{s}.parquet").write_bytes(b"")
    assert [Path(p).name for p in S.pbp_paths(tmp_path)] == [f"pbp_{s}.parquet" for s in S.SEASONS]
    (tmp_path / f"pbp_{S.FIRST}.parquet").unlink()
    try:
        S.pbp_paths(tmp_path)
        raise AssertionError("missing season not reported")
    except FileNotFoundError:
        pass


def test_no_hard_coded_season_range_in_lane_code_or_tests():
    import re
    pat = re.compile(r"range\(\s*2019\s*,\s*202\d\s*\)|\[\s*2019\s*,\s*2025\s*\]")
    paths = [*ROOT.glob("mining/*.py"), *ROOT.glob("backend/tests/test_build_*.py")]
    hits = [f"{p.name}:{i}" for p in paths for i, line in enumerate(p.read_text().splitlines(), 1)
            if pat.search(line) and p.name != "seasons.py"]
    assert hits == []
