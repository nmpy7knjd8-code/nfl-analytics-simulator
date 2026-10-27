"""Add the display_text column to existing game.v2 files in place (no full rebuild).

Same text as products.games.build (play_text.display_text + nflverse names). Use before
packing a new games release (games-v3):

    python backend/scripts/add_game_display_text.py <pbp_dir with pbp_{season}.parquet> [players.csv] [rosters_dir]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "src"))
from nfl_sim.play_names import PLAYERS_CSV, load_players, load_roster  # noqa: E402
from nfl_sim.products.games import PBP_COLS, SEASONS, play_display_texts  # noqa: E402

GAMES = ROOT / "frontend/public/data/games"


def main(pbp_dir: str, players: str = PLAYERS_CSV, rosters_dir: str | None = None) -> None:
    import pandas as pd

    names = load_players(players)
    n = 0
    for season in SEASONS:
        files = sorted(GAMES.glob(f"{season}_*_*.json"))
        if not files:
            continue
        roster = load_roster(season, rosters_dir and f"{rosters_dir}/roster_weekly_{season}.parquet")
        pbp = pd.read_parquet(Path(pbp_dir) / f"pbp_{season}.parquet", columns=PBP_COLS)
        pbp = pbp[pbp["desc"].notna()]
        by_game = {gid: g for gid, g in pbp.groupby("game_id")}
        for f in files:
            doc = json.loads(f.read_text())
            g = by_game[f.stem]
            recs = g.to_dict("records")
            text = dict(zip((int(r["play_id"]) for r in recs), play_display_texts(recs, names, roster)))
            cols = doc["cols"]
            cols["display_text"] = [text[pid] for pid in cols["play_id"]]
            f.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n")
            n += 1
    print(f"updated {n} game files")


if __name__ == "__main__":
    main(*sys.argv[1:4])
