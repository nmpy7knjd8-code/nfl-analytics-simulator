"""Empirical drive outcomes from a first down in the scoring zone (goal-line late-Q4 fix).

For every REG first down at yardline_100 1–40 in 2019–2021 (train seasons only; 2022–23
stay held out for the nflverse checks) record how the drive ended — touchdown, field goal,
or no points — and how many game seconds it took. Two regimes:

* ``normal``: everything else.
* ``need_td``: 4th quarter, ≤ 5:00 left, trailing by 4–8 (a field goal doesn't tie/lead).
  Only ~190 drives, so the engine uses the pooled ``all`` TD/FG rates everywhere (the
  need-TD TD share is within a few points of pooled) and takes only the hurry-up drive
  time from this regime.

Rates are smoothed with a logistic fit on log(yardline) per regime so they're monotone and
have no step at the 10 (1st & goal) — the raw shares are noisy at ~300 drives per yard.
Writes src/nfl_sim/models/scoring_zone_rates.json (small, committed):

    PYTHONPATH=src python scripts/build_scoring_zone_rates.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from nfl_sim.models.dataset import raw_season_path

OUT = Path(__file__).resolve().parents[1] / "src" / "nfl_sim" / "models" / "scoring_zone_rates.json"
SEASONS = (2019, 2020, 2021)
MAX_YL = 40


def _need_td(df: pd.DataFrame) -> pd.Series:
    return (df.qtr >= 4) & (df.game_seconds_remaining <= 300) & df.score_differential.between(-8, -4)


def main() -> None:
    cols = ["game_id", "season_type", "fixed_drive", "fixed_drive_result", "down", "yardline_100",
            "qtr", "game_seconds_remaining", "score_differential", "play_id", "posteam"]
    df = pd.concat([pd.read_parquet(raw_season_path(s), columns=cols) for s in SEASONS])
    df = df[(df.season_type == "REG") & df.posteam.notna() & df.down.notna()]
    end = df.groupby(["game_id", "fixed_drive"]).game_seconds_remaining.min().rename("drive_end_gsec")
    fd = df[(df.down == 1) & df.yardline_100.between(1, MAX_YL)]
    fd = fd.sort_values(["game_id", "play_id"]).drop_duplicates(["game_id", "fixed_drive", "yardline_100"])
    fd = fd.join(end, on=["game_id", "fixed_drive"])
    fd["elapsed"] = (fd.game_seconds_remaining - fd.drive_end_gsec).clip(lower=0)
    fd["y"] = np.select([fd.fixed_drive_result == "Touchdown", fd.fixed_drive_result == "Field goal"], [2, 1], 0)
    fd["regime"] = np.where(_need_td(fd), "need_td", "normal")
    out: dict[str, dict] = {}
    yls = np.arange(1, MAX_YL + 1)
    x_grid = np.c_[np.log(yls), yls]
    groups = [("all", fd)] + list(fd.groupby("regime"))
    for regime, g in groups:
        x = np.c_[np.log(g.yardline_100), g.yardline_100]
        clf = LogisticRegression(C=10.0, max_iter=2000).fit(x, g.y)
        p = clf.predict_proba(x_grid)
        classes = list(clf.classes_)
        el = g.groupby("yardline_100").elapsed.median().reindex(yls).interpolate().bfill().ffill()
        # smooth drive time: least squares line in yardline (median per yard is noisy)
        coef = np.polyfit(yls, el.to_numpy(), 1)
        out[regime] = {
            "n_drives": int(g[["game_id", "fixed_drive"]].drop_duplicates().shape[0]),
            "p_td": [round(float(v), 4) for v in p[:, classes.index(2)]],
            "p_fg": [round(float(v), 4) for v in p[:, classes.index(1)]],
            "drive_seconds": [round(float(max(5.0, np.polyval(coef, y))), 1) for y in yls],
            "raw_td_share": [round(float((g[g.yardline_100 == y].y == 2).mean()), 3) for y in yls],
        }
    OUT.write_text(json.dumps({
        "source": "nflverse play_by_play fixed_drive_result", "seasons": list(SEASONS),
        "yardline_100": [int(y) for y in yls], **out}, indent=1) + "\n")
    for r, v in out.items():
        print(r, v["n_drives"], "td@1,5,10,11,20,40:", [v["p_td"][i - 1] for i in (1, 5, 10, 11, 20, 40)],
              "fg:", [v["p_fg"][i - 1] for i in (1, 10, 20, 40)], "sec:", [v["drive_seconds"][i - 1] for i in (1, 10, 40)])


if __name__ == "__main__":
    main()
