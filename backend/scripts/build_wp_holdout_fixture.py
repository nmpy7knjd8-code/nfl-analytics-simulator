"""Snapshot the 2024–25 WP holdout (inputs + win label) so CI can score the shipped model.

The nflverse lake isn't in CI. This writes tests/fixtures/wp_holdout/holdout_2024_25.npz
with only the model's raw inputs (no nflverse wp/vegas_wp). Re-run after re-ingesting:

    PYTHONPATH=src python scripts/build_wp_holdout_fixture.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from nfl_sim.ingest.derive import derive_receive_2h_ko
from nfl_sim.models.dataset import build_wp_modeling_frame
from nfl_sim.models.wp_model import WP_HOLDOUT_SEASONS

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "wp_holdout" / "holdout_2024_25.npz"
COLS = ("score_differential", "game_seconds_remaining", "half_seconds_remaining", "down", "ydstogo",
        "yardline_100", "posteam_timeouts_remaining", "defteam_timeouts_remaining")


def main() -> None:
    f = build_wp_modeling_frame(WP_HOLDOUT_SEASONS).reset_index(drop=True)
    home = (f["posteam"] == f["home_team"]).to_numpy()
    line = f["spread_line"].astype(float).to_numpy()
    arrs = {c: f[c].astype(float).to_numpy(np.float32) for c in COLS}
    arrs["is_home"] = home.astype(np.int8)
    arrs["receive_2h_ko"] = derive_receive_2h_ko(f).astype(float).fillna(0).to_numpy(np.float32)
    arrs["posteam_spread"] = np.where(home, line, -line).astype(np.float32)
    arrs["season"] = f["season"].astype(np.int16).to_numpy()
    arrs["label"] = f["wp_label"].astype(np.int8).to_numpy()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(OUT, **arrs)
    print(f"wrote {OUT} ({len(f)} plays, {OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
