import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_player_names", ROOT / "mining/build_player_names.py")
bp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bp)
OUT = ROOT / "data/site/player_names.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|wp|vegas|spread|odds|line|win", re.I)


def test_build_maps_only_players_named_in_text():
    fakes = [{"game_id": "G", "qtr": 4, "clock": "01:00", "team": "AAA",
              "desc": "(1:00) (Punt formation) 8-M.Hayball pass to 80-J.Doe for 5 yards (21-X.Other)."}]
    pbp = [{"game_id": "G", "desc": fakes[0]["desc"], "passer_player_id": "00-1", "passer_player_name": "M.Hayball",
            "receiver_player_id": "00-2", "receiver_player_name": "J.Doe",
            "kicker_player_id": "00-3", "kicker_player_name": "K.Absent", "solo_tackle_1_player_id": None,
            "solo_tackle_1_player_name": None}]
    names = {"00-1": "Matthew Hayball", "00-2": "John Doe", "00-3": "Kay Absent"}
    d = bp.build(fakes, {}, pbp, names)
    assert d["names"] == {"00-1": "Matthew Hayball", "00-2": "John Doe"}
    assert d["plays"] == {"G|4|01:00|AAA": {"J.Doe": "00-2", "M.Hayball": "00-1"}}
    assert bp.named_in("to J.Doe.", "J.Doe") and not bp.named_in("to AJ.Doe", "J.Doe")


def test_committed_file_small_and_consistent():
    assert OUT.stat().st_size < 64_000
    d = json.loads(OUT.read_text())
    f = json.loads((ROOT / "data/site/fakes.json").read_text())
    fake_keys = {bp.play_key(p) for p in f["plays"]}
    real_keys = {bp.play_key(p) for p in f["real_punts"]}
    assert not fake_keys & real_keys
    assert set(d["plays"]) <= fake_keys | real_keys and len(d["plays"]) == 461 and len(d["names"]) == 515
    assert len(set(d["plays"]) & fake_keys) == 162 and set(d["plays"]) >= real_keys  # all 299 real punts
    used = {g for m in d["plays"].values() for g in m.values()}
    assert used == set(d["names"]) and all(re.fullmatch(r"00-\d{7}", g) for g in used)
    assert any(v == "Matthew Hayball" for v in d["names"].values())
    assert set(d) == {"schema_version", "source", "files", "names", "plays"}  # no play ids, wp or betting fields
    assert not [k for k in d if BANNED.search(k)]


def test_real_punt_names_mapped():
    d = json.loads(OUT.read_text())
    full = {d["names"][g] for m in d["plays"].values() for g in m.values()}
    assert {"Sterling Hofrichter", "Matt Haack"} <= full
