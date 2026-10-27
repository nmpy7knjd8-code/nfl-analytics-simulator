"""nflverse late-Q4 1st-and-goal reference for the goal-line engine tests.

Every REG 1st & goal in 2022–23 (held-out seasons; the engine fits on 2019–21) with
≤ 5:00 left in the 4th quarter and the offense within 8 points, with the engine inputs
and nflverse's own ``wp``. Writes tests/fixtures/wp_reference/late_goal_to_go.json:

    PYTHONPATH=src python scripts/build_goal_to_go_reference_fixture.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from nfl_sim.models.dataset import raw_season_path

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "wp_reference" / "late_goal_to_go.json"
SEASONS = (2022, 2023)


def main() -> None:
    cols = ["season_type", "down", "goal_to_go", "qtr", "game_seconds_remaining", "half_seconds_remaining",
            "score_differential", "yardline_100", "posteam_timeouts_remaining", "defteam_timeouts_remaining",
            "posteam", "home_team", "wp", "result"]
    df = pd.concat([pd.read_parquet(raw_season_path(s), columns=cols) for s in SEASONS])
    df = df[(df.season_type == "REG") & (df.down == 1) & (df.goal_to_go == 1) & (df.qtr == 4)
            & (df.game_seconds_remaining <= 300) & df.score_differential.between(-8, 8) & df.wp.notna()]
    home = df.posteam == df.home_team
    sign = np.sign(df.result)
    rows = [
        {"yl": int(r.yardline_100), "sd": int(r.score_differential), "gsec": int(r.game_seconds_remaining),
         "to_off": int(r.posteam_timeouts_remaining), "to_def": int(r.defteam_timeouts_remaining),
         "home": bool(h), "wp": round(float(r.wp), 4), "won": float((1 + s) / 2 if h else (1 - s) / 2)}
        for r, h, s in zip(df.itertuples(), home, sign)
    ]
    OUT.write_text(json.dumps({"source": "nflverse play_by_play wp", "seasons": list(SEASONS),
                               "filter": "REG 1st & goal, Q4 <= 5:00, |score_differential| <= 8", "rows": rows}) + "\n")
    print(len(rows), "rows")


if __name__ == "__main__":
    main()
