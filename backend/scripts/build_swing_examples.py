"""Build real swing plays for the example game pages (QA H5/M9).

Reads nflverse pbp, applies the shared swing filter, writes:
  frontend/lib/swingPlays.json                 (export for Product UI; shape in frontend/contracts/README.md)
  backend/tests/fixtures/swing_pbp_rows.json    (small pbp slice so CI can verify without raw data)

Usage: python backend/scripts/build_swing_examples.py /path/to/pbp_2023.parquet
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "src"))
from nfl_sim.swing_examples import FIXTURE_COLUMNS, GAME_IDS, build_export  # noqa: E402


def main(path: str) -> None:
    import pandas as pd

    df = pd.read_parquet(path, columns=FIXTURE_COLUMNS)
    df = df[df.game_id.isin(GAME_IDS) & df.play_id.notna()].copy()
    rows = json.loads(df.to_json(orient="records"))
    for r in rows:
        r["play_id"] = str(int(r["play_id"]))
    (ROOT / "backend/tests/fixtures/swing_pbp_rows.json").write_text(json.dumps(rows, separators=(",", ":")) + "\n")
    (ROOT / "frontend/lib/swingPlays.json").write_text(json.dumps(build_export(rows), indent=1) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
