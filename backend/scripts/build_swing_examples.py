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
from nfl_sim.swing_examples import FIXTURE_COLUMNS, GAME_IDS, NAME_ROLES, build_export, build_play_lists  # noqa: E402

PLAYERS_CSV = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv"


def main(path: str, players: str = PLAYERS_CSV) -> None:
    """players: nflverse players.csv (gsis_id -> display_name) for full names."""
    import pandas as pd

    id_cols = [f"{role}_player_id" for role in NAME_ROLES]
    df = pd.read_parquet(path, columns=FIXTURE_COLUMNS + id_cols)
    df = df[df.game_id.isin(GAME_IDS) & df.play_id.notna()].copy()
    names = pd.read_csv(players, usecols=["gsis_id", "display_name"]).dropna().set_index("gsis_id").display_name.to_dict()
    rows = json.loads(df.to_json(orient="records"))
    for r in rows:
        r["play_id"] = str(int(r["play_id"]))
        r["names"] = {role: names[r[f"{role}_player_id"]] for role in NAME_ROLES if r.get(f"{role}_player_id") in names}
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
