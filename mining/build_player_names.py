"""Build data/site/player_names.json: gsis_id -> full display name for players named in /fake-punt play text.

Source: nflverse players (players.parquet, display_name) and nflverse play-by-play 2019-2025 (the *_player_id /
*_player_name columns on each fake-punt play). fakes.json and fakesText.json carry no gsis ids, only short names
(e.g. "M.Hayball") inside play text, so this file also carries ``plays``: for each fake-punt play key
("game_id|qtr|clock|team", the key fakesText.json already uses) the short names in its text -> gsis_id. A
player is included only when nflverse lists him on that play and his short name appears in the play text.
fakes.json is not changed. No play ids, EPA, win chance or betting fields.

Usage: python mining/build_player_names.py PLAYERS_PARQUET PBP_PARQUET [...] [--out data/site/player_names.json]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/player_names.json"
FAKES = ROOT / "data/site/fakes.json"
FAKES_TEXT = ROOT / "frontend/lib/site/fakesText.json"


def play_key(p: dict[str, Any]) -> str:
    return f"{p['game_id']}|{p['qtr']}|{p['clock']}|{p['team']}"


def id_pairs(row: dict[str, Any]) -> list[tuple[str, str]]:
    """(short name, gsis id) for every nflverse player column on a play row."""
    out = []
    for c, v in row.items():
        if c.endswith("_id") and "player" in c and v:
            n = row.get(c[:-3] + "_name")
            if n:
                out.append((str(n), str(v)))
    return out


def named_in(text: str, short: str) -> bool:
    return re.search(r"(?<![\w.])" + re.escape(short) + r"(?![\w])", text) is not None


def build(fakes: list[dict[str, Any]], texts: dict[str, str], pbp: list[dict[str, Any]],
          names: dict[str, str]) -> dict[str, Any]:
    by_desc = {(r["game_id"], r["desc"]): r for r in pbp}
    plays: dict[str, dict[str, str]] = {}
    for p in fakes:
        r = by_desc.get((p["game_id"], p["desc"]))
        if r is None:
            raise SystemExit(f"no nflverse row for fake {play_key(p)}")
        text = p["desc"] + " " + texts.get(play_key(p), "")
        m = {s: g for s, g in id_pairs(r) if g in names and named_in(text, s)}
        if m:
            plays[play_key(p)] = dict(sorted(m.items()))
    ids = sorted({g for m in plays.values() for g in m.values()})
    return {"schema_version": 1, "source": "nflverse players + play-by-play via mining/build_player_names.py",
            "files": ["fakes.json"], "names": {g: names[g] for g in ids}, "plays": dict(sorted(plays.items()))}


def main(argv: list[str] | None = None) -> int:
    import pandas as pd
    ap = argparse.ArgumentParser()
    ap.add_argument("players")
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args(argv)
    fakes = json.loads(FAKES.read_text())["plays"]
    games = {p["game_id"] for p in fakes}
    pl = pd.read_parquet(a.players, columns=["gsis_id", "display_name"]).dropna()
    names = dict(zip(pl["gsis_id"], pl["display_name"]))
    rows = []
    for path in a.pbp:
        cols = [c for c in pd.read_parquet(path).columns if c in ("game_id", "desc") or "player" in c]
        df = pd.read_parquet(path, columns=cols)
        rows += json.loads(df[df["game_id"].isin(games)].to_json(orient="records"))
    doc = build(fakes, json.loads(FAKES_TEXT.read_text()), rows, names)
    out = Path(a.out)
    out.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(doc['names'])} players, {len(doc['plays'])} plays)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
