"""Build data/site/kickers.json so Charts UI can name the team's kicker on the F6 model-limits line.

Source: nflverse play-by-play 2019-2025 (REG+POST), kicker_player_id / kicker_player_name on field_goal
and extra_point plays (no kickoffs). Full names come from nflverse players display_name (same approach as
mining/build_player_names.py). A team's season kicker is the one with the most FG+XP attempts; a game
row is stored only when that game's kicker (most attempts; ties go to the last kick in the game) differs
from the season kicker. Charts UI looks up (game_id, team) in ``games`` and falls back to (season, team)
in ``rows``. 43 team-games with no FG/XP therefore use the season kicker. No betting, EPA, WPA or play_id
fields.

Frozen: published season and game rows never change; kick_plays stays the closed-season
total; new rows may only be appended from an open season past the week watermark
(mining/_frozen.py). Play-by-play is loaded with read_pbp (finished games only).

Usage: python mining/build_kickers.py PLAYERS_PARQUET PBP_PARQUET [...] [--out data/site/kickers.json]
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _frozen as fz  # noqa: E402
from _frozen import check_frozen as _check, check_rows, read_pbp  # noqa: E402
from build_stamp import stamp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/kickers.json"
FRONTEND = ROOT / "frontend/lib/site/kickers.json"
SCHEMA = "kickers/v1"
COLS = ["season", "team", "id", "name"]
GAME_COLS = ["game_id", "team", "id", "name"]
KICK_TYPES = ("field_goal", "extra_point")
PBP_COLUMNS = ["game_id", "season", "season_type", "game_date", "posteam", "play_type",
               "kicker_player_id", "kicker_player_name"]


def _name(kid: str, names: dict[str, str], short: dict[str, str]) -> str:
    if kid in names:
        return names[kid]
    if kid in short:
        return short[kid]
    raise ValueError(f"no display name for kicker {kid}")


def pick_kicker(ids: list[str]) -> str:
    """Modal kicker; ties go to the last id in order (the kicker who finished)."""
    counts = Counter(ids)
    top = max(counts.values())
    tied = {i for i, n in counts.items() if n == top}
    if len(tied) == 1:
        return next(iter(tied))
    for kid in reversed(ids):
        if kid in tied:
            return kid
    raise AssertionError("empty ids")


def build(plays: list[dict[str, Any]], names: dict[str, str]) -> dict[str, Any]:
    """plays: FG/XP rows with a kicker id and posteam, plus any row used only for dataThrough."""
    kicks = [r for r in plays if r.get("play_type") in KICK_TYPES
             and r.get("kicker_player_id") and r.get("posteam")]
    short: dict[str, str] = {}
    for r in kicks:
        short.setdefault(str(r["kicker_player_id"]), str(r.get("kicker_player_name") or ""))
    by_season: dict[tuple[int, str], list[str]] = defaultdict(list)
    by_game: dict[tuple[str, str], list[str]] = defaultdict(list)
    dates: list[str] = []
    for r in plays:
        d = str(r.get("game_date") or "")[:10]
        if d:
            dates.append(d)
    for r in kicks:
        kid = str(r["kicker_player_id"])
        team = str(r["posteam"])
        by_season[int(r["season"]), team].append(kid)
        by_game[str(r["game_id"]), team].append(kid)
    season_rows = []
    season_id: dict[tuple[int, str], str] = {}
    for key in sorted(by_season):
        kid = pick_kicker(by_season[key])
        season_id[key] = kid
        season, team = key
        season_rows.append([season, team, kid, _name(kid, names, short)])
    game_rows = []
    for (gid, team) in sorted(by_game):
        kid = pick_kicker(by_game[(gid, team)])
        season = int(gid[:4])
        if season_id.get((season, team)) == kid:
            continue
        game_rows.append([gid, team, kid, _name(kid, names, short)])
    seasons = sorted({s for s, _ in by_season})
    return {
        "schema": SCHEMA,
        "source": "nflverse play-by-play (CC BY 4.0), REG+POST; kicker on field_goal and extra_point plays",
        "builtAt": "",
        "dataThrough": max(dates) if dates else "",
        "season_list": seasons,
        "kick_plays": len(kicks),
        "cols": COLS,
        "rows": season_rows,
        "game_cols": GAME_COLS,
        "games": game_rows,
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"]:
        return []
    # Season rows have no game_id; a new team-season is frozen iff the season is closed.
    def as_rows(f: dict[str, Any], rec: str, cols: list[str]) -> list[dict[str, Any]]:
        return [dict(zip(cols, r)) for r in f.get(rec, [])]
    old_s, new_s = as_rows(old, "rows", old["cols"]), as_rows(new, "rows", new["cols"])
    newmap = {(r["season"], r["team"]): r for r in new_s}
    bad = [f"changed/removed {(r['season'], r['team'])}" for r in old_s
           if newmap.get((r["season"], r["team"])) != r]
    bad += check_rows(old_s, new_s, lambda r: (r["season"], r["team"]), "kickers",
                      gid=lambda r: f"{r['season']}_99_SEASON_ROW")
    bad += [f"summary {p}" for p in fz.grow_only(old.get("kick_plays"), new.get("kick_plays"), "kick_plays.")]
    o = {**old, "cols": old["game_cols"]}
    n = {**new, "cols": new["game_cols"]}
    bad += _check(o, n, lambda r: (r["game_id"], r["team"]), "games", name="kickers")
    return bad


def load(players: str, pbp: list[str]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    import pandas as pd

    pl = pd.read_parquet(players, columns=["gsis_id", "display_name"]).dropna(subset=["gsis_id", "display_name"])
    names = dict(zip(pl["gsis_id"].astype(str), pl["display_name"].astype(str)))
    df = read_pbp(pbp, PBP_COLUMNS)
    df["game_date"] = df["game_date"].astype(str)
    dates = df.drop_duplicates("game_id")[["game_id", "game_date", "season"]].copy()
    dates["play_type"] = None
    dates["posteam"] = None
    dates["kicker_player_id"] = None
    dates["kicker_player_name"] = None
    kicks = df[df["play_type"].isin(KICK_TYPES)]
    out = pd.concat([dates, kicks], ignore_index=True)
    return json.loads(out.to_json(orient="records")), names


def dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n"


def write_out(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    if path.resolve() == OUT.resolve():
        FRONTEND.parent.mkdir(parents=True, exist_ok=True)
        FRONTEND.write_text(text)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("players")
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args(argv)
    out = Path(a.out)
    new = build(*load(a.players, a.pbp))
    old = json.loads(out.read_text()) if out.exists() else None
    bad = check_frozen(old, new)
    if bad:
        print("FAIL: published kickers data would change: " + "; ".join(map(str, bad[:10])), file=sys.stderr)
        return 1
    write_out(out, dumps(stamp(new, old)))
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(new['rows'])} team-seasons, "
          f"{len(new['games'])} game overrides, {new['kick_plays']} kick plays)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
