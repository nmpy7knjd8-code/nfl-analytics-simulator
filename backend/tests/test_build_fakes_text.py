"""fakesText.json is the feed cleaner's output for every /fake-punt play, and stays in sync."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_fakes_text", ROOT / "mining/build_fakes_text.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def test_sidecar_matches_cleaner_output():
    fakes = json.loads(mod.SRC.read_text())
    assert mod.OUT.read_text() == mod.render(fakes)


def test_cleaner_strips_clock_snapper_and_jerseys():
    s = mod.plain_english(mod.clean_desc("(:07) 9-J.Bailey punts 45 yards to NE 20, Center-49-J.Cardona, fair catch by 11-J.Edelman."))
    assert s == "J.Bailey punts 45 yards to NE 20, fair catch by J.Edelman."


def test_plain_names_drops_team_prefixes_and_codes():
    s = mod.plain_names("M.Haack punts 54 yards to BAL 21, downed by NYJ-M.Farley. Pushed out at NO 48, recovered at PIT -3.")
    assert s == "M.Haack punts 54 yards to the Ravens 21, downed by M.Farley. Pushed out at the Saints 48, recovered at the Steelers end zone."


def test_sidecar_has_no_team_codes():
    import re
    full = list(json.loads(mod.NAMES.read_text())["names"].values())
    for t in json.loads(mod.OUT.read_text()).values():
        for n in full:  # full names like "AJ McCarron" are not team codes
            t = t.replace(n, "")
        assert not re.search(r"\b[A-Z]{2,3}\b|\b[A-Z]{2,3}-[A-Z]", t), t


def test_full_names_swaps_linked_short_names_only():
    s = mod.full_names("Direct snap to A.Levine. A.Levine up the middle, tackled by J.Grant and B.Skrine. AA.Levine",
                       {"A.Levine": "1", "J.Grant": "2", "B.Skrine": "3"}, {"1": "Anthony Levine", "2": "Jakeem Grant"})
    assert s == "Direct snap to Anthony Levine. Anthony Levine up the middle, tackled by Jakeem Grant and B.Skrine. AA.Levine"


def test_fake_plays_use_full_names_and_fakes_json_untouched():
    roster = json.loads(mod.NAMES.read_text())
    fakes = json.loads(mod.SRC.read_text())
    out = mod.build(fakes, roster)
    assert len(fakes["plays"]) == 162 and len(fakes["real_punts"]) == 299
    assert len(roster["plays"]) == 162 + 299  # fakes + real punts
    assert sum(any(full in out[k] for full in (roster["names"].get(g) for g in m.values()) if full) for k, m in roster["plays"].items()) == 461
    assert mod.build(fakes, {"names": {}, "plays": {}})["2019_01_BAL_MIA|2|02:59|BAL"].startswith("Direct snap to A.Levine.")
