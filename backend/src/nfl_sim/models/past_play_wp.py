"""Home-team win chance for real past plays: nflverse's published spread-aware WP.

Every real play (Game Story charts, swings, swing plays, opening WP, play lists, game
files) uses nflverse's ``vegas_home_wp`` (pre-snap) and ``vegas_home_wp + vegas_home_wpa``
(post-snap). Where nflverse leaves ``vegas_wp`` null (only the END GAME marker rows in
2019–25), our own WP model scores the row and ``wp_fallback`` is True. Our model is
otherwise used only for the what-if 4th-down states.

Exported field names stay neutral (``home_wp`` / ``home_wp_post`` / ``wp_fallback``);
no odds wording reaches fan-facing JSON.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[4]
NFLVERSE_WP_COLUMNS = ["vegas_wp", "vegas_home_wp", "vegas_home_wpa"]
# Inputs our model needs for fallback rows.
MODEL_INPUT_COLUMNS = ["score_differential", "game_seconds_remaining", "half_seconds_remaining", "down",
                       "ydstogo", "yardline_100", "posteam_timeouts_remaining", "defteam_timeouts_remaining",
                       "posteam", "defteam", "home_team", "qtr"]
SOURCE_NOTE = "nflverse published win probability (pre-snap / post-snap); our model only where nflverse has none"


def _load_model():
    from nfl_sim.models.wp_model import WPModel

    for p in (REPO_ROOT / "reports/wp/artifacts/wp_model.joblib",
              REPO_ROOT / "backend/tests/fixtures/grid_engine/wp_model.joblib"):
        if p.exists():
            return WPModel.load(p)
    raise FileNotFoundError("no WP model for fallback rows")


def past_play_home_wp(df: pd.DataFrame, model=None) -> pd.DataFrame:
    """Return ``home_wp``, ``home_wp_post`` (NaN where unknown) and ``wp_fallback`` for each row."""
    vwp = pd.to_numeric(df["vegas_wp"], errors="coerce")
    fallback = vwp.isna()
    pre = pd.to_numeric(df["vegas_home_wp"], errors="coerce").where(~fallback)
    post = (pre + pd.to_numeric(df["vegas_home_wpa"], errors="coerce")).clip(0.0, 1.0)
    if fallback.any():
        model = model or _load_model()
        rows = df.loc[fallback].copy()
        if "game_id" in df.columns:  # receive_2h_ko needs the whole game's first half
            ctx = df[df["game_id"].isin(rows["game_id"].unique())]
            from nfl_sim.ingest.derive import derive_receive_2h_ko

            rows["receive_2h_ko"] = derive_receive_2h_ko(ctx).reindex(rows.index)
        p = model.predict_wp(rows)
        is_home = (rows["posteam"].astype("string") == rows["home_team"].astype("string")).fillna(False).to_numpy()
        pre.loc[fallback] = np.where(is_home, p, 1.0 - p)
        post.loc[fallback] = np.nan
    return pd.DataFrame({"home_wp": pre.astype(float), "home_wp_post": post.astype(float),
                         "wp_fallback": fallback.to_numpy()}, index=df.index)
