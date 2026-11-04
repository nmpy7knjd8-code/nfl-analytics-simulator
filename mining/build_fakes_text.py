"""Build frontend/lib/site/fakesText.json: fan text for every play in data/site/fakes.json.

Runs each raw nflverse desc through the feed's play-text cleaner (backend nfl_sim.play_text:
clean_desc + plain_english, the same pass behind games display_text fallbacks), so /fake-punt never
shows "(:07) J.Bailey punts ... Center-J.Cardona". A sidecar keeps fakes.json frozen byte for byte.

Usage: python mining/build_fakes_text.py [--check]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend/src"))
from nfl_sim.play_text import clean_desc, plain_english  # noqa: E402

SRC = ROOT / "data/site/fakes.json"
OUT = ROOT / "frontend/lib/site/fakesText.json"


def key(p: dict) -> str:
    return f"{p['game_id']}|{p['qtr']}|{p['clock']}|{p['team']}"


def build(fakes: dict) -> dict[str, str]:
    return {key(p): plain_english(clean_desc(p["desc"])) for p in fakes["plays"] + fakes["real_punts"]}


def render(fakes: dict) -> str:
    return json.dumps(build(fakes), separators=(",", ":"), ensure_ascii=False, sort_keys=True) + "\n"


def main(argv: list[str]) -> int:
    text = render(json.loads(SRC.read_text()))
    if "--check" in argv:
        ok = OUT.exists() and OUT.read_text() == text
        print("fakesText.json up to date" if ok else "fakesText.json is stale; run mining/build_fakes_text.py", file=sys.stderr)
        return 0 if ok else 1
    OUT.write_text(text)
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
