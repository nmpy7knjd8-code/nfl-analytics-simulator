"""nflverse post-score / post-punt win chance reference for the 4th-down engine tests (H6).

For 2022–23 REG games, take the first snap of every drive that follows a touchdown,
a field goal or a punt, and record nflverse's own ``wp`` for the team that just
scored or punted (1 − wp of the receiving team), bucketed by quarter and score.
Writes backend/tests/fixtures/wp_reference/post_event_wp.json (small, committed)
so CI can check the engine without the nflverse lake:

    PYTHONPATH=src python scripts/build_wp_reference_fixture.py
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from nfl_sim.models.dataset import raw_season_path

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "wp_reference" / "post_event_wp.json"
SEASONS = (2022, 2023)
# event → score differential of the *receiving* team right after it, starting tied
EVENTS = {"Touchdown": -7, "Field goal": -3, "Punt": 0}


def main() -> None:
    cols = ["game_id", "season", "season_type", "fixed_drive", "fixed_drive_result", "play_id", "down",
            "ydstogo", "yardline_100", "qtr", "game_seconds_remaining", "half_seconds_remaining",
            "score_differential", "wp", "posteam", "home_team"]
    df = pd.concat([pd.read_parquet(raw_season_path(s), columns=cols) for s in SEASONS])
    df = df[(df.season_type == "REG") & df.down.notna() & df.wp.notna() & df.posteam.notna()]
    df = df.sort_values(["game_id", "play_id"])
    first = df.groupby(["game_id", "fixed_drive"], as_index=False).first()
    drives = df.groupby(["game_id", "fixed_drive"], as_index=False)["fixed_drive_result"].first()
    drives["next_drive"] = drives.fixed_drive + 1
    prev = drives.rename(columns={"fixed_drive_result": "prev_result"})[["game_id", "next_drive", "prev_result"]]
    m = first.merge(prev, left_on=["game_id", "fixed_drive"], right_on=["game_id", "next_drive"])
    m = m[(m.down == 1) & (m.qtr <= 3)]
    rows = []
    for ev, sd in EVENTS.items():
        for q in (1, 2, 3):
            s = m[(m.prev_result == ev) & (m.score_differential == sd) & (m.qtr == q)]
            if ev != "Punt":
                s = s[s.yardline_100.between(65, 80)]  # touchback-ish kickoff returns
            if q == 2:
                s = s[s.half_seconds_remaining >= 300]  # keep end-of-half kneels out
            if len(s) < 30:
                continue
            rows.append({
                "event": ev, "qtr": q, "receiving_score_differential": sd, "n": int(len(s)),
                "game_seconds_remaining": int(s.game_seconds_remaining.median()),
                "half_seconds_remaining": int(s.half_seconds_remaining.median()),
                "receiving_yardline_100": int(s.yardline_100.median()),
                "receiving_is_home_share": round(float((s.posteam == s.home_team).mean()), 3),
                "scoring_team_wp_nflverse": round(float(1 - s.wp.mean()), 4),
            })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": "nflverse play_by_play wp", "seasons": list(SEASONS), "rows": rows}, indent=1) + "\n")
    for r in rows:
        print(r)


if __name__ == "__main__":
    main()
