"""mining/build_fg_rates.py: A4 fg_rates.json (fg_rates/v1) counts match nflverse; published numbers frozen."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("build_fg_rates", ROOT / "mining/build_fg_rates.py")
fr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fr)

# every nflverse play_type == "field_goal" row for 2019 and 2025: [season, game_date, kick_distance, result]
RAW = json.loads((ROOT / "backend/tests/fixtures/fg_rates_pbp_rows.json").read_text())
ROWS = [{"season": s, "game_date": g, "play_type": "field_goal", "kick_distance": d, "field_goal_result": r}
        for s, g, d, r in RAW]
SITE = ROOT / "data/site/fg_rates.json"
FRONTEND_COPY = ROOT / "frontend/lib/site/fg_rates.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|moneyline", re.I)


@pytest.fixture(scope="module")
def built():
    return fr.build(ROWS)


def _recount(season, lo, hi):
    ks = [r for r in RAW if r[0] == season and lo <= r[2] <= hi]
    return [len(ks), sum(r[3] == "made" for r in ks)]


def test_fixture_is_full_nflverse_seasons():
    assert sum(r[0] == 2019 for r in RAW) == 1018 and sum(r[0] == 2025 for r in RAW) == 1140


def test_counts_match_nflverse_and_committed_file(built):
    site = json.loads(SITE.read_text())
    for season in ("2019", "2025"):
        expect = [_recount(int(season), lo, hi) for _, lo, hi in fr.BANDS]
        assert built["rates"][season] == expect
        assert site["rates"][season] == expect


def test_committed_all_is_sum_of_seasons():
    site = json.loads(SITE.read_text())
    seasons = [k for k in site["rates"] if k != "all"]
    assert seasons == [str(y) for y in range(2019, 2026)]
    for i in range(len(fr.BANDS)):
        assert site["rates"]["all"][i] == [sum(site["rates"][k][i][j] for k in seasons) for j in (0, 1)]
    # 2019-2025: 7,627 field goal tries, 18 over 64 yd left out
    assert sum(t for t, _ in site["rates"]["all"]) == 7609


def test_blocked_count_as_tries_and_over_64_dropped():
    rows = [{"season": 2025, "game_date": "2025-09-07", "play_type": "field_goal", "kick_distance": d,
             "field_goal_result": r} for d, r in [(33, "blocked"), (33, "made"), (65, "made"), (70, "blocked")]]
    rows.append({"season": 2025, "game_date": "2025-09-07", "play_type": "punt", "kick_distance": 40,
                 "field_goal_result": None})
    out = fr.build(rows)
    assert out["rates"]["2025"][1] == [2, 1]
    assert sum(t for t, _ in out["rates"]["all"]) == 2


def test_bands_contiguous_and_capped():
    assert fr.BANDS[0][1] == 0 and fr.BANDS[-1][2] == fr.MAX_FG == 64
    for (_, _, hi), (_, lo, _) in zip(fr.BANDS, fr.BANDS[1:]):
        assert lo == hi + 1
    assert fr.band_index(64) == 5 and fr.band_index(65) is None and fr.band_index(29) == 0


def test_frozen_fail_on_change(built):
    old = json.loads(fr.dumps(built))
    assert fr.check_frozen(old, built) == []
    old["rates"]["2019"][0][1] -= 1
    assert "2019" in fr.check_frozen(old, built)
    # adding a new season is allowed and may update "all"
    newer = json.loads(fr.dumps(built))
    newer["rates"]["2026"] = [[1, 1]] * 6
    newer["rates"]["all"] = [[t + 1, m + 1] for t, m in newer["rates"]["all"]]
    assert fr.check_frozen(json.loads(fr.dumps(built)), newer) == []


def test_frozen_change_exits_nonzero_and_writes_nothing(tmp_path, built, monkeypatch):
    out = tmp_path / "fg_rates.json"
    old = json.loads(fr.dumps(built))
    old["rates"]["2025"][5] = [0, 0]
    out.write_text(json.dumps(old))
    before = sorted(p.name for p in tmp_path.iterdir())
    monkeypatch.setattr(fr, "load_rows", lambda paths: ROWS)
    assert fr.main(["x.parquet", "--out", str(out)]) == 1
    assert json.loads(out.read_text())["rates"]["2025"][5] == [0, 0]
    assert sorted(p.name for p in tmp_path.iterdir()) == before


def test_committed_file_small_clean_and_shape():
    text = SITE.read_text()
    data = json.loads(text)
    assert SITE.stat().st_size < 4_000
    assert not BANNED.search(text)
    assert set(data) == {"schema", "source", "builtAt", "seasons", "maxYards", "fewKicksBelow", "bands", "rates"}
    assert data["schema"] == "fg_rates/v1" and data["maxYards"] == 64 and data["seasons"] == [2019, 2025]
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", data["builtAt"])
    for counts in data["rates"].values():
        assert len(counts) == 6 and all(0 <= m <= t for t, m in counts)


def test_frontend_copy_matches_when_built():
    """The UI imports frontend/lib/site/fg_rates.json; once it is not a stub it must equal the CI-built file."""
    if not FRONTEND_COPY.exists():
        pytest.skip("frontend copy not merged yet")
    front = json.loads(FRONTEND_COPY.read_text())
    if front.get("stub"):
        pytest.skip("frontend still on the stub")
    assert front == json.loads(SITE.read_text())
