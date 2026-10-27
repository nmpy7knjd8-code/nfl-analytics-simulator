"""Build real swing plays for the example game pages (QA H5/M9).

Reads nflverse pbp, applies the shared swing filter, writes:
  frontend/lib/swingPlays.json                 (export for Product UI; shape in frontend/contracts/README.md)
  frontend/lib/plays/<game_id>.json            (every real play per game)
  backend/tests/fixtures/swing_pbp_rows.json    (small pbp slice so CI can verify without raw data)

Usage: python backend/scripts/build_swing_examples.py /path/to/pbp_2023.parquet
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "src"))
from nfl_sim.play_names import ID_COLS, PLAYERS_CSV, attach_names, load_players, load_roster  # noqa: E402
from nfl_sim.swing_examples import FIXTURE_COLUMNS, GAME_IDS, build_export, build_play_lists  # noqa: E402

def main(path: str, players: str = PLAYERS_CSV, rosters: str | None = None) -> None:
    """players: nflverse players.csv (gsis_id -> display_name) for full names."""
    import pandas as pd

    from nfl_sim.models.past_play_wp import MODEL_INPUT_COLUMNS, NFLVERSE_WP_COLUMNS, past_play_home_wp

    extra = [c for c in NFLVERSE_WP_COLUMNS + MODEL_INPUT_COLUMNS if c not in FIXTURE_COLUMNS + ID_COLS]
    read = [c for c in FIXTURE_COLUMNS if c != "wp_fallback"]
    df = pd.read_parquet(path, columns=list(dict.fromkeys(read + ID_COLS + extra)))
    df = df[df.game_id.isin(GAME_IDS) & df.play_id.notna()].copy()
    # Real past plays: nflverse's published (spread-aware) WP; our model only where it is null.
    df[["home_wp", "home_wp_post", "wp_fallback"]] = past_play_home_wp(df)
    df = df.drop(columns=extra)
    names, roster = load_players(players), load_roster(2023, rosters)
    rows = json.loads(df.to_json(orient="records"))
    for r in rows:
        r["play_id"] = str(int(r["play_id"]))
        attach_names(r, names, roster)
    (ROOT / "backend/tests/fixtures/swing_pbp_rows.json").write_text(json.dumps(rows, separators=(",", ":")) + "\n")
    (ROOT / "frontend/lib/swingPlays.json").write_text(json.dumps(build_export(rows), separators=(",", ":")) + "\n")
    out = ROOT / "frontend/lib/plays"
    out.mkdir(exist_ok=True)
    for gid, plays in build_play_lists(rows).items():
        (out / f"{gid}.json").write_text(json.dumps({"game_id": gid, "plays": plays}, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main(*sys.argv[1:3])
