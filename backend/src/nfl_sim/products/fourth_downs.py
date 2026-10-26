"""Every regulation 4th down 2019–2025 from nflverse, valued once by the shared engine.

The games, daily, and coach products all read this one table, so a play's values
are identical everywhere. Cached (gitignored) at data/products/fourth_downs.parquet.

    python -m nfl_sim.products.fourth_downs [procs]
"""
from __future__ import annotations

import json
import sys
from multiprocessing import Pool

import pandas as pd

from nfl_sim.products.engine import ENGINE_VERSION, EngineInput, load_engine
from nfl_sim.products.meta import REPO_ROOT

SEASONS = tuple(range(2019, 2026))
CACHE = REPO_ROOT / "data" / "products" / "fourth_downs.parquet"
PBP_COLS = ["game_id", "play_id", "season", "season_type", "week", "game_date", "home_team", "away_team",
            "posteam", "defteam", "qtr", "quarter_seconds_remaining", "down", "ydstogo", "yardline_100",
            "score_differential", "posteam_score", "defteam_score", "posteam_timeouts_remaining",
            "defteam_timeouts_remaining", "play_type", "desc", "home_coach", "away_coach", "home_wp", "wp",
            "yards_gained", "fourth_down_converted", "fourth_down_failed", "field_goal_result", "touchdown",
            "punt_blocked", "interception", "fumble_lost", "game_seconds_remaining", "half_seconds_remaining"]
ACTUAL = {"pass": "go", "run": "go", "field_goal": "fg", "punt": "punt"}


def load_pbp(season: int, columns=None) -> pd.DataFrame:
    return pd.read_parquet(REPO_ROOT / "data" / "raw" / "pbp" / f"season={season}" / "play_by_play.parquet",
                           columns=columns)


def opening_receivers(pbp: pd.DataFrame) -> dict[str, str]:
    """nflverse kickoff rows carry the receiving team as posteam."""
    k = pbp[(pbp["play_type"] == "kickoff") & (pbp["qtr"] == 1)].sort_values(["game_id", "play_id"])
    return k.groupby("game_id")["posteam"].first().to_dict()


def candidate_rows(season: int) -> pd.DataFrame:
    pbp = load_pbp(season)
    recv = opening_receivers(pbp)
    df = pbp[(pbp["down"] == 4) & (pbp["qtr"] <= 4) & pbp["play_type"].isin(list(ACTUAL))][PBP_COLS].copy()
    df["actual"] = df["play_type"].map(ACTUAL)
    df["receive_2h_ko"] = [int(q <= 2 and recv.get(g) not in (None, p)) for g, q, p in
                           zip(df["game_id"], df["qtr"], df["posteam"])]
    df["is_home_possession"] = df["posteam"] == df["home_team"]
    df["result"] = [outcome(r) for r in df.to_dict("records")]
    return df.dropna(subset=["yardline_100", "ydstogo", "quarter_seconds_remaining", "score_differential"])


def outcome(r: dict) -> str:
    """What happened next, from nflverse flags (never inferred from the model)."""
    a = ACTUAL.get(r["play_type"])
    if a == "fg":
        return {"made": "fg_made", "missed": "fg_missed", "blocked": "fg_blocked"}.get(r["field_goal_result"], "fg_other")
    if a == "punt":
        return "punt_blocked" if r.get("punt_blocked") == 1 else "punt"
    if r.get("touchdown") == 1 and r.get("interception") != 1 and r.get("fumble_lost") != 1:
        return "touchdown"
    if r.get("fourth_down_converted") == 1:
        return "converted"
    return "turnover" if r.get("interception") == 1 or r.get("fumble_lost") == 1 else "failed"


_ENGINE = None


def _init():
    global _ENGINE
    _ENGINE = load_engine()


def _eval(row: dict):
    try:
        x = EngineInput.from_play_row(row)
    except ValueError:
        return None
    return json.dumps(_ENGINE.evaluate(x).to_dict(), sort_keys=True)


def build(procs: int = 8) -> pd.DataFrame:
    df = pd.concat([candidate_rows(s) for s in SEASONS], ignore_index=True)
    with Pool(procs, initializer=_init) as pool:
        df["engine"] = pool.map(_eval, df.to_dict("records"), chunksize=128)
    df = df[df["engine"].notna()].reset_index(drop=True)
    df["engine_version"] = ENGINE_VERSION
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(CACHE, index=False)
    return df


def load() -> pd.DataFrame:
    if not CACHE.exists():
        raise FileNotFoundError(f"{CACHE} missing; run python -m nfl_sim.products.fourth_downs")
    return pd.read_parquet(CACHE)


if __name__ == "__main__":
    d = build(int(sys.argv[1]) if len(sys.argv) > 1 else 8)
    print(len(d), d.groupby("season").size().to_dict())
