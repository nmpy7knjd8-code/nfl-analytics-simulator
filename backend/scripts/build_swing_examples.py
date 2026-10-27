"""Build real swing plays for the example game pages (QA H5/M9).

Reads nflverse pbp, applies the shared swing filter, writes:
  frontend/lib/swingPlays.json                 (export for Product UI; shape in frontend/contracts/README.md)
  frontend/lib/plays/<game_id>.json            (every real play per game)
  backend/tests/fixtures/swing_pbp_rows.json    (small pbp slice so CI can verify without raw data)

Usage: python backend/scripts/build_swing_examples.py /path/to/pbp_2023.parquet
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "src"))
from nfl_sim.swing_examples import FIXTURE_COLUMNS, GAME_IDS, NAME_ROLES, build_export, build_play_lists  # noqa: E402

ROSTERS = "https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_2023.parquet"
PLAYERS_CSV = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"


_PEN = re.compile(r"PENALTY on ([A-Z]{2,3})-(\d{1,2})-[A-Za-z]+\.([\w'\-]+)", re.I)


def penalty_names(r: dict, roster: dict) -> dict:
    """'TEAM-JERSEY' -> full name for every penalized player, from that week's nflverse roster (last name must match)."""
    week = int(r["game_id"].split("_")[1])
    out = {}
    for team, num, last in _PEN.findall(r.get("desc") or ""):
        full = roster.get((week, team, int(num)))
        if full and full.split()[-1].lower().startswith(last.lower()[:4]):
            out[f"{team}-{num}"] = full
    return out


def main(path: str, players: str = PLAYERS_CSV, rosters: str = ROSTERS) -> None:
    """players: nflverse players.csv (gsis_id -> display_name) for full names."""
    import pandas as pd

    id_cols = [f"{role}_player_id" for role in NAME_ROLES]
    from nfl_sim.models.past_play_wp import MODEL_INPUT_COLUMNS, NFLVERSE_WP_COLUMNS, past_play_home_wp

    extra = [c for c in NFLVERSE_WP_COLUMNS + MODEL_INPUT_COLUMNS if c not in FIXTURE_COLUMNS]
    read = [c for c in FIXTURE_COLUMNS if c != "wp_fallback"]
    df = pd.read_parquet(path, columns=list(dict.fromkeys(read + id_cols + extra)))
    df = df[df.game_id.isin(GAME_IDS) & df.play_id.notna()].copy()
    # Real past plays: nflverse's published (spread-aware) WP; our model only where it is null.
    df[["home_wp", "home_wp_post", "wp_fallback"]] = past_play_home_wp(df)
    df = df.drop(columns=extra)
    names = pd.read_csv(players, usecols=["gsis_id", "display_name"]).dropna().set_index("gsis_id").display_name.to_dict()
    ros = pd.read_parquet(rosters, columns=["week", "team", "jersey_number", "full_name"]).dropna()
    roster = {(int(w), t, int(j)): n for w, t, j, n in ros.itertuples(index=False)}
    rows = json.loads(df.to_json(orient="records"))
    for r in rows:
        r["play_id"] = str(int(r["play_id"]))
        r["names"] = {role: names[r[f"{role}_player_id"]] for role in NAME_ROLES if r.get(f"{role}_player_id") in names}
        if pen := penalty_names(r, roster):
            r["names"]["penalties"] = pen
        for c in id_cols:
            r.pop(c, None)
    (ROOT / "backend/tests/fixtures/swing_pbp_rows.json").write_text(json.dumps(rows, separators=(",", ":")) + "\n")
    (ROOT / "frontend/lib/swingPlays.json").write_text(json.dumps(build_export(rows), separators=(",", ":")) + "\n")
    out = ROOT / "frontend/lib/plays"
    out.mkdir(exist_ok=True)
    for gid, plays in build_play_lists(rows).items():
        (out / f"{gid}.json").write_text(json.dumps({"game_id": gid, "plays": plays}, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main(*sys.argv[1:3])
