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
