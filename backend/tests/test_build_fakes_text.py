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
    for t in json.loads(mod.OUT.read_text()).values():
        assert not re.search(r"\b[A-Z]{2,3}\b|\b[A-Z]{2,3}-[A-Z]", t), t
