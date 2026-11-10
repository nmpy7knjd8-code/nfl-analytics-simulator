"""mining/build_kickers.py: F6 kickers.json counts match nflverse; every team-season has a kicker."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_kickers", ROOT / "mining/build_kickers.py")
bk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bk)
FILE = ROOT / "data/site/kickers.json"
FRONTEND = ROOT / "frontend/lib/site/kickers.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|moneyline", re.I)

# nflverse 2019-2025 REG+POST: field_goal + extra_point plays with kicker_player_id
NFLVERSE_KICK_PLAYS = 16725
TEAM_SEASONS = 224
GAME_OVERRIDES = 343
SEASONS = list(range(2019, 2026))


def _play(season, gid, team, kid, name, date="2099-09-10", typ="field_goal"):
    return {"season": season, "game_id": gid, "posteam": team, "kicker_player_id": kid,
            "kicker_player_name": name, "game_date": date, "play_type": typ}


def test_season_kicker_is_modal_and_game_override_only_when_different():
    names = {"K1": "Ann Alpha", "K2": "Bob Beta"}
    plays = [
        _play(2099, "2099_01_A_B", "A", "K1", "A.Alpha"),
        _play(2099, "2099_01_A_B", "A", "K1", "A.Alpha", typ="extra_point"),
        _play(2099, "2099_02_A_C", "A", "K1", "A.Alpha"),
        _play(2099, "2099_03_A_D", "A", "K2", "B.Beta"),  # mid-season change
        _play(2099, "2099_03_A_D", "D", "K2", "B.Beta"),
        # no-play (missing id) and kickoffs must not count
        _play(2099, "2099_01_A_B", "A", None, None),
        {"season": 2099, "game_id": "2099_01_A_B", "posteam": "B", "kicker_player_id": "K9",
         "kicker_player_name": "Z.Zed", "game_date": "2099-09-10", "play_type": "kickoff"},
        # date-only row from a later game with no kicks
        {"season": 2099, "game_id": "2099_22_A_B", "posteam": None, "kicker_player_id": None,
         "kicker_player_name": None, "game_date": "2100-02-08", "play_type": None},
    ]
    d = bk.build(plays, names)
    assert d["rows"] == [[2099, "A", "K1", "Ann Alpha"], [2099, "D", "K2", "Bob Beta"]]
    assert d["games"] == [["2099_03_A_D", "A", "K2", "Bob Beta"]]
    assert d["kick_plays"] == 5 and d["dataThrough"] == "2100-02-08"
    assert d["season_list"] == [2099]


def test_tie_goes_to_last_kicker_in_the_game():
    names = {"K1": "Ann Alpha", "K2": "Bob Beta"}
    plays = [
        _play(2099, "2099_01_A_B", "A", "K1", "A.Alpha"),
        _play(2099, "2099_01_A_B", "A", "K2", "B.Beta", typ="extra_point"),
        # season plurality is K1, so the game (tied, last=K2) is an override
        _play(2099, "2099_02_A_C", "A", "K1", "A.Alpha"),
        _play(2099, "2099_02_A_C", "A", "K1", "A.Alpha"),
    ]
    d = bk.build(plays, names)
    assert d["rows"] == [[2099, "A", "K1", "Ann Alpha"]]
    assert d["games"] == [["2099_01_A_B", "A", "K2", "Bob Beta"]]


def test_counts_match_nflverse_and_every_team_season_has_a_kicker():
    d = json.loads(FILE.read_text())
    assert d["kick_plays"] == NFLVERSE_KICK_PLAYS
    assert d["season_list"] == SEASONS
    assert len(d["rows"]) == TEAM_SEASONS
    assert len(d["games"]) == GAME_OVERRIDES
    assert {r[0] for r in d["rows"]} == set(SEASONS)
    for season in SEASONS:
        teams = [r[1] for r in d["rows"] if r[0] == season]
        assert len(teams) == 32 and len(set(teams)) == 32
    assert all(r[2] and r[3] and " " in r[3] for r in d["rows"])
    assert all(g[2] and g[3] and " " in g[3] for g in d["games"])
    # a game override is never the same kicker as that team's season row
    season = {(r[0], r[1]): r[2] for r in d["rows"]}
    for gid, team, kid, _name in d["games"]:
        assert season[(int(gid[:4]), team)] != kid


def test_committed_known_kickers_use_full_names():
    d = json.loads(FILE.read_text())
    rows = {(r[0], r[1]): r for r in d["rows"]}
    games = {(g[0], g[1]): g for g in d["games"]}
    assert rows[2019, "BAL"] == [2019, "BAL", "00-0029597", "Justin Tucker"]
    assert rows[2023, "NYG"] == [2023, "NYG", "00-0026858", "Graham Gano"]
    assert rows[2022, "LAC"] == [2022, "LAC", "00-0037224", "Cameron Dicker"]
    assert games["2022_03_KC_IND", "KC"] == ["2022_03_KC_IND", "KC", "00-0036469", "Matt Ammendola"]
    assert games["2023_15_NYG_NO", "NYG"] == ["2023_15_NYG_NO", "NYG", "00-0035042", "Jamie Gillan"]
    # 1-1 mid-game tie, last kicker is the season kicker, so no override
    assert ("2025_03_KC_NYG", "NYG") not in games


def test_committed_file_small_clean_and_shape():
    text = FILE.read_text()
    d = json.loads(text)
    assert FILE.stat().st_size < 35_000
    assert not BANNED.search(text)
    assert set(d) == {"schema", "source", "builtAt", "dataThrough", "season_list", "kick_plays",
                      "cols", "rows", "game_cols", "games"}
    assert d["schema"] == "kickers/v1" and d["dataThrough"] == "2026-02-08"
    assert d["cols"] == ["season", "team", "id", "name"]
    assert d["game_cols"] == ["game_id", "team", "id", "name"]
    assert not [k for k in set(d) | set(d["cols"]) | set(d["game_cols"]) if BANNED.search(k)]


def test_frozen():
    d = json.loads(FILE.read_text())
    assert bk.check_frozen(d, d) == []
    assert bk.check_frozen(None, d) == []
    new = json.loads(json.dumps(d))
    new["rows"][0][3] = "Nope"
    assert bk.check_frozen(d, new)
    new = json.loads(json.dumps(d))
    new["games"][0][2] = "00-0000000"
    assert bk.check_frozen(d, new)
    # a new season may be added and may change kick_plays
    newer = json.loads(json.dumps(d))
    newer["season_list"] = d["season_list"] + [2026]
    newer["rows"] = d["rows"] + [[2026, "BAL", "00-0029597", "Justin Tucker"]]
    newer["kick_plays"] = d["kick_plays"] + 1
    assert bk.check_frozen(d, newer) == []


def test_frozen_change_exits_nonzero_and_writes_nothing(tmp_path, monkeypatch):
    out = tmp_path / "kickers.json"
    old = json.loads(FILE.read_text())
    out.write_text(bk.dumps(old))
    tweaked = json.loads(json.dumps(old))
    tweaked["rows"][0][3] = "Nope"
    monkeypatch.setattr(bk, "load", lambda players, pbp: (
        [{"season": r[0], "game_id": f"{r[0]}_01_A_{r[1]}", "posteam": r[1],
          "kicker_player_id": r[2], "kicker_player_name": n, "game_date": "2026-02-08",
          "play_type": "field_goal"}
         for r, n in zip(tweaked["rows"], [x[3] for x in tweaked["rows"]])],
        {r[2]: r[3] for r in tweaked["rows"]},
    ))
    before = out.read_text()
    assert bk.main(["players.parquet", "x.parquet", "--out", str(out)]) == 1
    assert out.read_text() == before
    assert not (tmp_path / "never-written").exists()


def test_frontend_copy_identical():
    assert FRONTEND.read_bytes() == FILE.read_bytes()
