"""Build frontend/lib/site/fakesText.json: fan text for every play in data/site/fakes.json.

Runs each raw nflverse desc through the feed's play-text cleaner (backend nfl_sim.play_text:
clean_desc + plain_english, the same pass behind games display_text fallbacks), so /fake-punt never
shows "(:07) J.Bailey punts ... Center-J.Cardona". Then plain_names() drops "NYJ-" prefixes before
player names and turns field spots like "NYG 44" into "the Giants 44" (nicknames from
frontend/lib/teams.ts). Last, full_names() swaps short names (M.Hayball) for full ones (Michael Hayball)
using data/site/player_names.json (plays keyed game_id|qtr|clock|team -> short name -> gsis_id, names
gsis_id -> display name); names with no match keep the short form. A sidecar keeps fakes.json frozen byte for byte.

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
NAMES = ROOT / "data/site/player_names.json"
GAME_NAMES = ROOT / "data/site/player_names_game.json"  # "game_id|short" -> gsis for players linked elsewhere in the game


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


def full_names(s: str, short_to_id: dict[str, str], names: dict[str, str]) -> str:
    """'punts by A.Levine' -> 'punts by Anthony Levine' when the play links A.Levine to a gsis_id with a name."""
    pairs = {short: names[g] for short, g in short_to_id.items() if names.get(g)}
    if not pairs:
        return s
    alt = "|".join(re.escape(k) for k in sorted(pairs, key=len, reverse=True))
    def swap(m: re.Match) -> str:
        full, short = pairs[m.group(0)], m.group(0)
        # 'by M.Sanu Sr.' at a sentence end: the short name's own period was also the sentence's period.
        if short.endswith(".") and not full.endswith(".") and re.match(r"\s*($|[A-Z(])", s[m.end():]):
            full += "."
        return full
    s = re.sub(rf"(?<![\w.'-])(?:{alt})(?![\w'-])", swap, s)
    # 'to S.Franklin.' -> 'to Sam Franklin Jr..': a full name ending in a period meets the sentence's own period.
    return re.sub(r"\b(Jr|Sr|[A-Z])\.\.(?=\s|$)", r"\1.", s)


TOKEN = r"[A-Z][a-z]?\.(?:[A-Z]\.)*(?:Van )?[A-Z][A-Za-z'-]+(?: (?:Jr|Sr)\.| I{2,3}\b)?"
_DROP = [  # unresolved short names: drop the name, never guess one
    (re.compile(rf"(downed|recovered|tackled|fair catch|out of bounds) by {TOKEN}"), r"\1"),
    (re.compile(rf"(?:^|(?<=\. )|(?<=, )){TOKEN} was injured during the play\.\s*"), ""),
    (re.compile(rf"Direct snap to {TOKEN}\.\s*"), ""),
    (re.compile(rf"Penalty on {TOKEN}, "), "Penalty, "),
]


def drop_unresolved(s: str) -> str:
    """'downed by V.Biegel.' -> 'downed.' when no nflverse id links V.Biegel."""
    for rx, rep in _DROP:
        s = rx.sub(rep, s)
    return s.strip()


def after_reversal(s: str) -> str:
    """Replay-reversed plays: keep only the ruling that stands (as the games feed does)."""
    i = s.rfind("the play was reversed.")
    return s[i + len("the play was reversed."):].strip() if i >= 0 else s


def capitalize(s: str) -> str:
    """Upper-case each sentence start ('He is Out. penalty on' -> 'Penalty on'); not after Jr./Sr./initials."""
    s = s[:1].upper() + s[1:]
    return re.sub(r"(?<!\bJr)(?<!\bSr)(?<!\b[A-Z])\. ([a-z])", lambda m: ". " + m.group(1).upper(), s)


def load_names() -> dict:
    r = json.loads(NAMES.read_text()) if NAMES.exists() else {"names": {}, "plays": {}}
    if GAME_NAMES.exists():
        g = json.loads(GAME_NAMES.read_text())
        r = {**r, "names": {**g["names"], **r["names"]}, "game": g["plays"]}
    return r


def build(fakes: dict, roster: dict | None = None) -> dict[str, str]:
    roster = load_names() if roster is None else roster
    out = {}
    for p in fakes["plays"] + fakes["real_punts"]:
        k = key(p)
        g = p["game_id"] + "|"
        ids = {short[len(g):]: i for short, i in roster.get("game", {}).items() if short.startswith(g)}
        ids.update(roster["plays"].get(k, {}))
        s = after_reversal(plain_names(plain_english(clean_desc(p["desc"]))))
        out[k] = capitalize(drop_unresolved(full_names(s, ids, roster["names"])))
    return out


def render(fakes: dict, roster: dict | None = None) -> str:
    return json.dumps(build(fakes, roster), separators=(",", ":"), ensure_ascii=False, sort_keys=True) + "\n"


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
