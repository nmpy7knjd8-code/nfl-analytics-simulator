"""Every regulation 4th down 2019–2025 from nflverse, valued once by the shared engine.

Real-game what-ifs are team-aware: the offense/defense conversion and kicker FG shifts
(empirical Bayes, that season's earlier games only; models/team_strength.py) and the game's
pregame spread go into the separate spread WP model. Both are internal inputs: the table keeps
only the shift columns, never the spread, and no fan field carries either.

The games, daily, and coach products all read this one table, so a play's values
are identical everywhere. Cached (gitignored) at data/products/fourth_downs.parquet.

    python -m nfl_sim.products.fourth_downs [procs]
"""
from __future__ import annotations

import json
import sys
from dataclasses import replace
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
PRIORS_REPORT = REPO_ROOT / "reports" / "fourth_down" / "team_strength_priors.json"
REAL_GAME_INPUTS = "team_aware.v1"  # EB team shifts + spread WP model
ACTUAL = {"pass": "go", "run": "go", "field_goal": "fg", "punt": "punt"}


def load_pbp(season: int, columns=None) -> pd.DataFrame:
    return pd.read_parquet(REPO_ROOT / "data" / "raw" / "pbp" / f"season={season}" / "play_by_play.parquet",
                           columns=columns)


def opening_receivers(pbp: pd.DataFrame) -> dict[str, str]:
    """nflverse kickoff rows carry the receiving team as posteam."""
    k = pbp[(pbp["play_type"] == "kickoff") & (pbp["qtr"] == 1)].sort_values(["game_id", "play_id"])
    return k.groupby("game_id")["posteam"].first().to_dict()


def team_strength_model():
    from nfl_sim.models.team_strength import PBP_COLUMNS, PRIOR_SEASONS, TeamStrengthModel

    cols = PBP_COLUMNS + ["home_team", "away_team"]
    return TeamStrengthModel.fit({s: load_pbp(s, cols) for s in PRIOR_SEASONS})


def candidate_rows(season: int, strength=None) -> pd.DataFrame:
    pbp = load_pbp(season)
    recv = opening_receivers(pbp)
    df = pbp[(pbp["down"] == 4) & (pbp["qtr"] <= 4) & pbp["play_type"].isin(list(ACTUAL))][PBP_COLS].copy()
    df["actual"] = df["play_type"].map(ACTUAL)
    df["receive_2h_ko"] = [int(q <= 2 and recv.get(g) not in (None, p)) for g, q, p in
                           zip(df["game_id"], df["qtr"], df["posteam"])]
    df["is_home_possession"] = df["posteam"] == df["home_team"]
    df["result"] = [outcome(r) for r in df.to_dict("records")]
    if strength is not None:
        sh = strength.season_shifts(pbp).set_index(["game_id", "team"])
        off = sh.reindex(list(zip(df["game_id"], df["posteam"])))
        de = sh.reindex(list(zip(df["game_id"], df["defteam"])))
        df["convert_shift"] = (off["convert_off_shift"].to_numpy() + de["convert_def_shift"].to_numpy())
        df["fg_make_shift"] = off["fg_make_shift"].to_numpy()
        df[["convert_shift", "fg_make_shift"]] = df[["convert_shift", "fg_make_shift"]].fillna(0.0)
        # internal-only pregame input, dropped after evaluation (never stored)
        df["_home_spread"] = df["game_id"].map(pbp.drop_duplicates("game_id").set_index("game_id")["spread_line"])
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
    _ENGINE = load_engine(with_spread_model=True)


def real_game_input(row: dict) -> EngineInput:
    x = EngineInput.from_play_row(row)
    hs = row.get("_home_spread")
    return replace(x, convert_shift=float(row.get("convert_shift") or 0.0),
                   fg_make_shift=float(row.get("fg_make_shift") or 0.0),
                   home_spread=None if hs is None or hs != hs else float(hs))


def _eval(row: dict):
    try:
        x = real_game_input(row)
    except ValueError:
        return None
    return json.dumps(_ENGINE.evaluate(x).to_dict(), sort_keys=True)


def build(procs: int = 8) -> pd.DataFrame:
    strength = team_strength_model()
    PRIORS_REPORT.parent.mkdir(parents=True, exist_ok=True)
    PRIORS_REPORT.write_text(json.dumps(strength.priors(), indent=2, sort_keys=True) + "\n")
    df = pd.concat([candidate_rows(s, strength) for s in SEASONS], ignore_index=True)
    with Pool(procs, initializer=_init) as pool:
        df["engine"] = pool.map(_eval, df.to_dict("records"), chunksize=128)
    df = df[df["engine"].notna()].reset_index(drop=True)
    df = df.drop(columns=["_home_spread"])
    df["engine_version"] = ENGINE_VERSION
    df["real_game_inputs"] = REAL_GAME_INPUTS
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
