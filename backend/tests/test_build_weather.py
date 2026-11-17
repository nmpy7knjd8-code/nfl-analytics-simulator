"""mining/build_weather.py (G6): open-air games only, nflverse weather, band numbers match the spec."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_weather", ROOT / "mining/build_weather.py")
bw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bw)
FILE = ROOT / "data/site/weather.json"
FRONT = ROOT / "frontend/public/data/stories/weather.json"
OVERRIDE = ROOT / "mining/frozen_overrides/weather-2026-11-10-text-fallback.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|line|wp", re.I)
BLANK = {
    "2019_02_PHI_ATL": "no usable text (Temp: ° F, Wind: mph)",
    "2019_07_LA_ATL": "no usable text (Wind: mph, no wind number)",
    "2019_08_SEA_ATL": "no usable text (Wind: mph, no wind number)",
    "2023_02_GB_ATL": "roof conflict (open roof, text says Indoors / Wind: N/A)",
    "2023_02_IND_HOU": "roof conflict (open roof, text says Indoors)",
    "2023_02_NYJ_DAL": "no text",
    "2023_03_DAL_ARI": "no usable text (N/A Indoors Temp: Humidity: Wind: mph)",
    "2025_11_WAS_MIA": "no text",
}


def g(gid, roof="outdoors", temp=40, wind=12, h=20, a=10, weather=None):
    return {"game_id": gid, "game_date": "2099-09-10", "roof": roof, "temp": temp, "wind": wind,
            "home_score": h, "away_score": a, "weather": weather}


def test_parse_weather_text_rules():
    p = bw.parse_weather_text
    assert p("Temp: 71° F, Humidity: 87%, Wind: West 3 mph") == (3, 71)
    assert p("Sunny Temp: 58° F, Humidity: 50%, Wind: WSW 10 mph") == (10, 58)
    assert p("Temp: 74° F, Humidity: 91%, Wind: SSE 6mph mph") == (6, 74)
    assert p("Temp: ° F, Wind: mph") is None
    assert p("Temp: 66° F, Humidity: 79%, Wind: mph") is None
    assert p("sUNNY Temp: 65° F, Humidity: 63%, Wind: mph") is None
    assert p("Indoors Temp: 72° F, Humidity: 25%, Wind: N/A 0 mph") is None
    assert p("Indoors Temp: 85° F, Humidity: 47%, Wind: N 6 mph") is None
    assert p("N/A Indoors Temp: Humidity: Wind: mph") is None
    assert p("") is None and p(None) is None
    # numeric already present is not this function's job; a one-sided reading is unused
    assert p("Temp: 66° F, Humidity: 79%, Wind: mph") is None


def test_dome_closed_missing_have_no_weather():
    d = bw.build([g("2099_01_A_B"), g("2099_01_C_D", roof="dome", temp=None, wind=None),
                  g("2099_01_E_F", roof="closed"), g("2099_01_G_H", wind=None), g("2099_01_I_J", roof="open"),
                  g("2022_17_BUF_CIN")])
    assert d["games"] == {"2099_01_A_B": [12, 40], "2099_01_I_J": [12, 40]}
    assert d["bands"]["wind"][1] == {"mph": [10, 14], "games": 2, "avg_points": 30.0}


def test_text_fallback_only_when_both_numeric_empty():
    text = "Temp: 71° F, Humidity: 87%, Wind: West 3 mph"
    d = bw.build([g("2099_01_A_B", temp=None, wind=None, weather=text)])
    assert d["games"]["2099_01_A_B"] == [3, 71]
    # one numeric present: do not mix in the text
    mixed = bw.build([g("2099_01_C_D", temp=40, wind=None, weather=text)])
    assert "2099_01_C_D" not in mixed["games"]
    # Indoors text on an open-air roof stays blank
    indoors = bw.build([g("2023_02_GB_ATL", temp=None, wind=None,
                          weather="Indoors Temp: 72° F, Humidity: 25%, Wind: N/A 0 mph")])
    assert "2023_02_GB_ATL" not in indoors["games"]
    # numeric values win when present; text is ignored
    kept = bw.build([g("2099_01_E_F", temp=40, wind=12, weather=text)])
    assert kept["games"]["2099_01_E_F"] == [12, 40]


def test_committed_file_matches_spec_bands():
    d = json.loads(FILE.read_text())
    assert len(d["games"]) == 1353
    w = {tuple(b["mph"]): (b["games"], b["avg_points"]) for b in d["bands"]["wind"]}
    assert w[(0, 9)] == (881, 45.7) and w[(10, 14)] == (320, 42.8) and w[(15, 19)] == (119, 42.1)
    assert w[(20, None)] == (33, 44.0)
    t = {tuple(b["f"]): (b["games"], b["avg_points"]) for b in d["bands"]["temp"]}
    assert t[(None, 32)] == (91, 45.1) and t[(33, 50)] == (356, 42.8)
    assert t[(51, 70)] == (530, 45.4) and t[(71, None)] == (376, 45.4)
    assert sum(b["games"] for b in d["bands"]["wind"]) == 1353
    assert not [k for k in set(d) | set(d["cols"]) if BANNED.search(k)]
    assert FILE.stat().st_size < 45_000
    assert FILE.read_bytes() == FRONT.read_bytes()
    for gid in BLANK:
        assert gid not in d["games"] and gid not in d["indoors"]
    # a showcase W4 miss now has a row
    assert d["games"]["2023_01_DET_KC"]


def test_frozen():
    d = json.loads(FILE.read_text())
    assert bw.check_frozen(d, d) == []
    new = json.loads(json.dumps(d))
    gid = next(iter(new["games"]))
    new["games"][gid] = [99, 99]
    assert bw.check_frozen(d, new) == [gid]


def test_override_cannot_allow_anything_wider():
    d = json.loads(FILE.read_text())
    allowed = bw.load_override(str(OVERRIDE))
    assert allowed[0] and allowed[1]
    o = json.loads(OVERRIDE.read_text())
    assert o["rule"] == "text_fallback" and o["approved_by"] and len(o["games"]) == 154
    assert bw.check_frozen(d, d, *allowed) == []
    # an unlisted game (roof-conflict) may not be added
    extra = json.loads(json.dumps(d))
    extra["games"]["2023_02_GB_ATL"] = [0, 72]
    assert bw.check_frozen(d, extra, *allowed) == ["games added: 2023_02_GB_ATL"]
    # a published game's values may not change
    changed = json.loads(json.dumps(d))
    gid = next(iter(changed["games"]))
    changed["games"][gid] = [99, 99]
    assert bw.check_frozen(d, changed, *allowed) == [gid]
    # a band cell not listed (wind 20+ avg_points stayed 44.0) may not change
    band = json.loads(json.dumps(d))
    for b in band["bands"]["wind"]:
        if b["mph"] == [20, None]:
            b["avg_points"] = 99.0
    assert bw.check_frozen(d, band, *allowed) == ["bands.wind.[20, None].avg_points"]
    # indoors is not in the override
    indoors = json.loads(json.dumps(d))
    indoors["indoors"] = list(indoors["indoors"]) + ["2023_02_NYJ_DAL"]
    assert "indoors" in " ".join(bw.check_frozen(d, indoors, *allowed)) or any(
        x.startswith("indoors") for x in bw.check_frozen(d, indoors, *allowed)
    )


def test_indoors_lists_dome_and_closed_only():
    d = json.loads(FILE.read_text())
    assert d["indoors"] and not set(d["indoors"]) & set(d["games"])
    assert d["indoors"] == sorted(d["indoors"])
