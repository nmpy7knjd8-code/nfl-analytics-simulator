"""mining/build_fg_rates.py: A4 fg_rates.json (fg_rates/v2) counts match nflverse; published numbers frozen."""
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


def _recount(season, yd):
    ks = [r for r in RAW if r[0] == season and r[2] == yd]
    return [len(ks), sum(r[3] == "made" for r in ks)]


def _band(rows, lo, hi):
    return [sum(rows[y - 18][j] for y in range(max(lo, 18), hi + 1)) for j in (0, 1)]


def test_fixture_is_full_nflverse_seasons():
    assert sum(r[0] == 2019 for r in RAW) == 1018 and sum(r[0] == 2025 for r in RAW) == 1140


def test_counts_match_nflverse_and_committed_file(built):
    site = json.loads(SITE.read_text())
    for season in ("2019", "2025"):
        expect = [_recount(int(season), y) for y in range(18, 65)]
        assert built["yards"][season] == expect
        assert site["yards"][season] == expect


def test_committed_all_is_sum_of_seasons():
    site = json.loads(SITE.read_text())
    seasons = [k for k in site["yards"] if k != "all"]
    assert seasons == [str(y) for y in range(2019, 2026)]
    for i in range(47):
        assert site["yards"]["all"][i] == [sum(site["yards"][k][i][j] for k in seasons) for j in (0, 1)]
    # 2019-2025: 7,627 field goal tries, 18 over 64 yd left out
    assert sum(t for t, _ in site["yards"]["all"]) == 7609
    # band totals = the verified v1 numbers (97.9/93.1/78.7/72.1/61.0/42.4%)
    assert [_band(site["yards"]["all"], lo, hi) for _, lo, hi in fr.BANDS] == [
        [1721, 1685], [2132, 1985], [2222, 1748], [1040, 750], [428, 261], [66, 28]]


def test_blocked_count_as_tries_and_over_64_dropped():
    rows = [{"season": 2025, "game_date": "2025-09-07", "play_type": "field_goal", "kick_distance": d,
             "field_goal_result": r} for d, r in [(33, "blocked"), (33, "made"), (65, "made"), (70, "blocked")]]
    rows.append({"season": 2025, "game_date": "2025-09-07", "play_type": "punt", "kick_distance": 40,
                 "field_goal_result": None})
    out = fr.build(rows)
    assert out["yards"]["2025"][33 - 18] == [2, 1]
    assert sum(t for t, _ in out["yards"]["all"]) == 2
    with pytest.raises(ValueError):
        fr.build([{**rows[0], "kick_distance": 17}])


def test_bands_contiguous_and_capped():
    assert fr.BANDS[0][1] == 0 and fr.BANDS[-1][2] == fr.MAX_FG == 64
    for (_, _, hi), (_, lo, _) in zip(fr.BANDS, fr.BANDS[1:]):
        assert lo == hi + 1
    assert fr.band_index(64) == 5 and fr.band_index(65) is None and fr.band_index(29) == 0


def test_frozen_fail_on_change(built):
    old = json.loads(fr.dumps(built))
    assert fr.check_frozen(old, built) == []
    old["yards"]["2019"][10][1] -= 1
    assert "2019" in fr.check_frozen(old, built)
    old = json.loads(fr.dumps(built))
    old["yards"]["all"][0][0] += 1
    assert fr.check_frozen(old, built) == ["all"]
    # adding a new season is allowed and may update "all"
    newer = json.loads(fr.dumps(built))
    newer["yards"]["2026"] = [[1, 1]] * 47
    newer["yards"]["all"] = [[t + 1, m + 1] for t, m in newer["yards"]["all"]]
    assert fr.check_frozen(json.loads(fr.dumps(built)), newer) == []


def test_frozen_change_exits_nonzero_and_writes_nothing(tmp_path, built, monkeypatch):
    out = tmp_path / "fg_rates.json"
    old = json.loads(fr.dumps(built))
    old["yards"]["2025"][46] = [0, 0]
    out.write_text(json.dumps(old))
    before = sorted(p.name for p in tmp_path.iterdir())
    monkeypatch.setattr(fr, "load_rows", lambda paths: ROWS)
    assert fr.main(["x.parquet", "--out", str(out)]) == 1
    assert json.loads(out.read_text())["yards"]["2025"][46] == [0, 0]
    assert sorted(p.name for p in tmp_path.iterdir()) == before


def test_committed_file_small_clean_and_shape():
    text = SITE.read_text()
    data = json.loads(text)
    assert SITE.stat().st_size < 6_000
    assert not BANNED.search(text)
    assert set(data) == {"schema", "source", "builtAt", "seasons", "minYards", "maxYards",
                         "fewKicksBelow", "smoothYards", "bands", "yards"}
    assert data["schema"] == "fg_rates/v2" and (data["minYards"], data["maxYards"], data["smoothYards"]) == (18, 64, 2)
    assert data["seasons"] == list(range(2019, 2026))
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", data["builtAt"])
    for counts in data["yards"].values():
        assert len(counts) == 47 and all(0 <= m <= t for t, m in counts)


def test_frontend_copy_matches_when_built():
    """The UI imports frontend/lib/site/fg_rates.json; once it is not a stub it must equal the CI-built file."""
    if not FRONTEND_COPY.exists():
        pytest.skip("frontend copy not merged yet")
    front = json.loads(FRONTEND_COPY.read_text())
    site = json.loads(SITE.read_text())
    if front.get("stub") or front.get("schema") != site["schema"]:
        pytest.skip("frontend still on the stub / older schema")
    assert front == site
