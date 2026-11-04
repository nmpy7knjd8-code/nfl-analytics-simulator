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
    full = list(mod.load_names()["names"].values())
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
    assert mod.build(fakes, {"names": {}, "plays": {}})["2019_01_BAL_MIA|2|02:59|BAL"].startswith("A.Levine")  # unlinked snap name dropped


def test_full_names_collapses_doubled_period_after_suffix():
    s = mod.full_names("pass incomplete short left to S.Franklin. Next.", {"S.Franklin": "1"}, {"1": "Sam Franklin Jr."})
    assert s == "pass incomplete short left to Sam Franklin Jr. Next."
    assert mod.full_names("to S.Franklin.", {"S.Franklin": "1"}, {"1": "Sam Franklin Jr."}) == "to Sam Franklin Jr."


def test_no_sidecar_value_has_doubled_period():
    out = json.loads(mod.OUT.read_text())
    assert not [v for v in out.values() if ".." in v]


def test_real_punts_use_the_same_full_name_swap():
    fakes = json.loads(mod.SRC.read_text())
    p = fakes["real_punts"][0]
    k = mod.key(p)
    out = mod.build(fakes, {"names": {"g": "Matt Bosher"}, "plays": {k: {"M.Bosher": "g"}}})
    assert "Matt Bosher" in out[k] and "M.Bosher" not in out[k]
    assert "M.Bosher" in mod.build(fakes, {"names": {}, "plays": {}})[k]


def test_suffix_short_name_keeps_sentence_period():
    out = mod.full_names("fair catch by M.Sanu Sr.", {"M.Sanu Sr.": "g"}, {"g": "Mohamed Sanu"})
    assert out == "fair catch by Mohamed Sanu."
    assert mod.full_names("M.Sanu Sr. to NE 21", {"M.Sanu Sr.": "g"}, {"g": "Mohamed Sanu"}) == "Mohamed Sanu to NE 21"


def test_no_initials_or_orphan_fumbles_left():
    import re
    out = json.loads(mod.OUT.read_text())
    assert not [v for v in out.values() if re.search(r"\b[A-Z]\.[A-Z][a-z]", v) or ". fumbles" in v]
    assert not [v for v in out.values() if re.search(r"(?<!\bJr)(?<!\bSr)(?<!\b[A-Z])\. [a-z]", v)]


def test_unresolved_names_are_dropped_not_guessed():
    assert mod.drop_unresolved("punts to the Ravens 21, downed by V.Biegel. R.McMillan was injured during the play.") == "punts to the Ravens 21, downed."
    assert mod.drop_unresolved("Direct snap to N.Niemann. J.Kelley up the middle.") == "J.Kelley up the middle."
    assert mod.drop_unresolved("out of bounds. Penalty on R.Beal, Running Into the Kicker.") == "out of bounds. Penalty, Running Into the Kicker."


def test_reversed_play_keeps_only_the_ruling_that_stands():
    s = "X for 4 yards. fumbles, recovered by B.Skrine. The Replay Official reviewed the fumble ruling, and the play was reversed. X for 4 yards."
    assert mod.after_reversal(s) == "X for 4 yards."
    out = json.loads(mod.OUT.read_text())
    assert out["2019_05_CHI_OAK|4|05:48|LV"] == "Erik Harris right guard to the Raiders 31 for 4 yards."


def test_sentence_starts_capitalized():
    assert mod.capitalize("He is Out. penalty on X. Sam Franklin Jr. to the 5") == "He is Out. Penalty on X. Sam Franklin Jr. to the 5"
