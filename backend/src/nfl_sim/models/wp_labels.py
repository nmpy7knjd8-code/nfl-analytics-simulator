"""Win-probability labels and eligibility (docs/WP_MODEL_SPEC.md)."""

from __future__ import annotations

import pandas as pd


def construct_win_labels(pbp: pd.DataFrame) -> pd.Series:
    """Binary label: 1 if posteam wins the game, 0 if loses; NA for ties/unknown.

    Uses max ``home_score`` / ``away_score`` per ``game_id`` as final totals
    (scores are nondecreasing within a game in nflverse PBP). Never uses lake
    ``wp`` / ``vegas_wp``.
    """
    if pbp.empty:
        return pd.Series(dtype="Int64")

    hs = pd.to_numeric(pbp["home_score"], errors="coerce")
    as_ = pd.to_numeric(pbp["away_score"], errors="coerce")
    finals = (
        pd.DataFrame({"game_id": pbp["game_id"].to_numpy(), "hs": hs.to_numpy(), "as_": as_.to_numpy()})
        .groupby("game_id", sort=False)
        .agg(final_home=("hs", "max"), final_away=("as_", "max"))
        .reset_index()
    )
    mapped = pbp[["game_id"]].merge(finals, on="game_id", how="left")
    home_f = mapped["final_home"]
    home_f.index = pbp.index
    away_f = mapped["final_away"]
    away_f.index = pbp.index

    posteam = pbp["posteam"].astype("string")
    home_team = pbp["home_team"].astype("string")
    if "away_team" in pbp.columns:
        away_team = pbp["away_team"].astype("string")
    else:
        away_team = pd.Series(pd.NA, index=pbp.index, dtype="string")

    known = home_f.notna() & away_f.notna() & posteam.notna() & home_team.notna()
    tie = known & (home_f == away_f)
    home_wins = known & ~tie & (home_f > away_f)
    away_wins = known & ~tie & (away_f > home_f)

    is_home_poss = posteam == home_team
    is_away_poss = posteam == away_team

    label = pd.Series(pd.NA, index=pbp.index, dtype="Int64")
    label.loc[is_home_poss & home_wins] = 1
    label.loc[is_home_poss & away_wins] = 0
    label.loc[is_away_poss & away_wins] = 1
    label.loc[is_away_poss & home_wins] = 0
    return label


def score_differential_consistent(pbp: pd.DataFrame) -> pd.Series:
    """True when score_differential matches posteam_score − defteam_score (if both present)."""
    if "score_differential" not in pbp.columns:
        return pd.Series(False, index=pbp.index)
    sd = pd.to_numeric(pbp["score_differential"], errors="coerce")
    if "posteam_score" not in pbp.columns or "defteam_score" not in pbp.columns:
        return sd.notna()
    ps = pd.to_numeric(pbp["posteam_score"], errors="coerce")
    ds = pd.to_numeric(pbp["defteam_score"], errors="coerce")
    both = ps.notna() & ds.notna()
    ok = sd.notna() & (~both | (sd - (ps - ds)).abs().le(0.5))
    return ok.fillna(False)


def wp_eligible_mask(pbp: pd.DataFrame, labels: pd.Series) -> pd.Series:
    """REG scrimmage with valid pre-play WP fields + binary win label (ties excluded)."""
    season_type = (
        pbp["season_type"].astype("string")
        if "season_type" in pbp.columns
        else pd.Series("REG", index=pbp.index)
    )
    down = pd.to_numeric(pbp["down"], errors="coerce")
    distance = pd.to_numeric(pbp["ydstogo"], errors="coerce")
    y100 = pd.to_numeric(pbp["yardline_100"], errors="coerce")
    half = pd.to_numeric(pbp["half_seconds_remaining"], errors="coerce")
    gsec = pd.to_numeric(pbp["game_seconds_remaining"], errors="coerce")
    sd = pd.to_numeric(pbp["score_differential"], errors="coerce")
    away_ok = pbp["away_team"].notna() if "away_team" in pbp.columns else pd.Series(True, index=pbp.index)
    return (
        season_type.eq("REG")
        & down.notna()
        & distance.notna()
        & y100.notna()
        & half.notna()
        & gsec.notna()
        & sd.notna()
        & pbp["posteam"].notna()
        & pbp["home_team"].notna()
        & away_ok
        & score_differential_consistent(pbp)
        & labels.notna()
        & labels.isin([0, 1])
    )
