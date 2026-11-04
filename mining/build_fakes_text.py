"""Build frontend/lib/site/fakesText.json: fan text for every play in data/site/fakes.json.

Runs each raw nflverse desc through the feed's play-text cleaner (backend nfl_sim.play_text:
clean_desc + plain_english, the same pass behind games display_text fallbacks), so /fake-punt never
shows "(:07) J.Bailey punts ... Center-J.Cardona". Then plain_names() drops "NYJ-" prefixes before
player names and turns field spots like "NYG 44" into "the Giants 44" (nicknames from
frontend/lib/teams.ts). Player names stay short (M.Hayball): fakes.json has no player ids and the repo
has no local roster file. A sidecar keeps fakes.json frozen byte for byte.

Usage: python mining/build_fakes_text.py [--check]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend/src"))
from nfl_sim.play_text import clean_desc, plain_english  # noqa: E402

SRC = ROOT / "data/site/fakes.json"
OUT = ROOT / "frontend/lib/site/fakesText.json"
TEAMS_TS = ROOT / "frontend/lib/teams.ts"


def load_nicknames() -> dict[str, str]:
    body = TEAMS_TS.read_text().split("const NICKNAMES", 1)[1].split("};", 1)[0]
    return {k: v for k, v in re.findall(r'^\s*(\w+): "([^"]+)"', body, re.M) if k not in ("OFF", "DEF")}


NICK = load_nicknames()
_CODES = "|".join(sorted(NICK, key=len, reverse=True))
_PREFIX = re.compile(rf"\b(?:{_CODES})-(?=[A-Z][a-z]*\.)")
_SPOT = re.compile(rf"\b(?:the )?({_CODES}) (-?\d{{1,2}})\b")


def plain_names(s: str) -> str:
    """'downed by NYJ-M.Farley at NO 48' -> 'downed by M.Farley at the Saints 48'."""
    s = _PREFIX.sub("", s)

    def spot(m: re.Match) -> str:
        n = int(m.group(2))
        return f"the {NICK[m.group(1)]} end zone" if n <= 0 else f"the {NICK[m.group(1)]} {n}"
    return _SPOT.sub(spot, s)


def key(p: dict) -> str:
    return f"{p['game_id']}|{p['qtr']}|{p['clock']}|{p['team']}"


def build(fakes: dict) -> dict[str, str]:
    return {key(p): plain_names(plain_english(clean_desc(p["desc"]))) for p in fakes["plays"] + fakes["real_punts"]}


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
