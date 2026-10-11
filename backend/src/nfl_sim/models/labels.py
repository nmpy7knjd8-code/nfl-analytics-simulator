"""Next-score-in-half label construction per docs/EP_MODEL_SPEC.md."""

from __future__ import annotations

import numpy as np
import pandas as pd

from nfl_sim.models.constants import EP_CLASSES


def half_bucket(qtr: pd.Series) -> pd.Series:
    """1 = first half (Q1–Q2); 2 = second half + OT (Q3–Q5)."""
    q = pd.to_numeric(qtr, errors="coerce")
    out = pd.Series(pd.NA, index=qtr.index, dtype="Int64")
    out.loc[q.isin([1, 2])] = 1
    out.loc[q.isin([3, 4, 5])] = 2
    return out


def _flag(series: pd.Series | None, index: pd.Index) -> pd.Series:
    if series is None:
        return pd.Series(False, index=index)
    return pd.to_numeric(series, errors="coerce").fillna(0).astype(int).eq(1)


def scoring_event_team(df: pd.DataFrame) -> pd.Series:
    """Return scoring team abbrev or NA if row is not a scoring play.

    Priority: TD > safety > made FG (EP_MODEL_SPEC §3.1).
    """
    idx = df.index
    is_td = _flag(df["touchdown"] if "touchdown" in df.columns else None, idx)
    is_safety = _flag(df["safety"] if "safety" in df.columns else None, idx)
    fg_made = pd.Series(False, index=idx)
    if "field_goal_result" in df.columns:
        fg_made = df["field_goal_result"].astype("string").str.lower().eq("made")

    posteam = df["posteam"].astype("string") if "posteam" in df.columns else pd.Series(pd.NA, index=idx, dtype="string")
    defteam = df["defteam"].astype("string") if "defteam" in df.columns else pd.Series(pd.NA, index=idx, dtype="string")
    td_team = (
        df["td_team"].astype("string")
        if "td_team" in df.columns
        else pd.Series(pd.NA, index=idx, dtype="string")
    )

    scorer = pd.Series(pd.NA, index=idx, dtype="string")

    # Touchdowns
    td_scorer = td_team.where(td_team.notna(), posteam)
    # Defensive/return TD: if td_team missing but interception/fumble_lost, credit defteam
    if "interception" in df.columns or "fumble_lost" in df.columns:
        turnover = _flag(df["interception"] if "interception" in df.columns else None, idx) | _flag(
            df["fumble_lost"] if "fumble_lost" in df.columns else None, idx
        )
        td_scorer = td_scorer.where(~(is_td & turnover & td_team.isna()), defteam)
    scorer = scorer.where(~is_td, td_scorer)

    # Safeties: points awarded to the defense of the team tackled in EZ.
    # nflverse `safety == 1` on the play; scoring team is typically defteam of that row.
    safety_scorer = defteam
    scorer = scorer.where(~(~is_td & is_safety), safety_scorer)

    # Made field goals: kicking posteam
    scorer = scorer.where(~(~is_td & ~is_safety & fg_made), posteam)

    return scorer


def class_from_scorer(posteam_at_t: str | None, scorer: str | None, event: str) -> str | None:
    """Map scoring event + teams → EP class name."""
    if posteam_at_t is None or (isinstance(posteam_at_t, float) and np.isnan(posteam_at_t)):
        return None
    if event == "NoScore":
        return "NoScore"
    if scorer is None or (isinstance(scorer, float) and np.isnan(scorer)):
        return None
    p = str(posteam_at_t)
    s = str(scorer)
    same = s == p
    if event == "Touchdown":
        return "Touchdown" if same else "OppTouchdown"
    if event == "FieldGoal":
        return "FieldGoal" if same else "OppFieldGoal"
    if event == "Safety":
        return "Safety" if same else "OppSafety"
    return None


def _event_type(row_is_td: bool, row_is_safety: bool, row_fg_made: bool) -> str | None:
    if row_is_td:
        return "Touchdown"
    if row_is_safety:
        return "Safety"
    if row_fg_made:
        return "FieldGoal"
    return None


def construct_next_score_labels(pbp: pd.DataFrame) -> pd.Series:
    """For each row, next-score-in-half class from perspective of that row's posteam.

    Returns a string Series aligned to `pbp.index` with NA where label cannot be built.
    """
    if pbp.empty:
        return pd.Series(dtype="string")

    df = pbp.sort_values(["game_id", "play_id"], kind="mergesort").reset_index(drop=True)
    hb = half_bucket(df["qtr"])
    scorers = scoring_event_team(df)
    is_td = _flag(df["touchdown"] if "touchdown" in df.columns else None, df.index)
    is_safety = _flag(df["safety"] if "safety" in df.columns else None, df.index)
    fg_made = pd.Series(False, index=df.index)
    if "field_goal_result" in df.columns:
        fg_made = df["field_goal_result"].astype("string").str.lower().eq("made")

    labels = pd.Series(pd.NA, index=df.index, dtype="string")

    # Process per game/half for clarity and correctness
    for (_, _), group in df.groupby(["game_id", hb], sort=False):
        if group.empty or pd.isna(group.name[1] if False else True):
            pass
        g_idx = group.index.to_numpy()
        g_posteam = group["posteam"].astype("string").to_numpy()
        g_scorer = scorers.loc[group.index].to_numpy()
        g_td = is_td.loc[group.index].to_numpy()
        g_safe = is_safety.loc[group.index].to_numpy()
        g_fg = fg_made.loc[group.index].to_numpy()

        n = len(g_idx)
        # Precompute next scoring index within group
        next_score_i = np.full(n, -1, dtype=int)
        next_event = np.full(n, None, dtype=object)
        next_scorer = np.full(n, None, dtype=object)
        last_i = -1
        last_ev = None
        last_sc = None
        for i in range(n - 1, -1, -1):
            ev = _event_type(bool(g_td[i]), bool(g_safe[i]), bool(g_fg[i]))
            if ev is not None:
                last_i = i
                last_ev = ev
                last_sc = g_scorer[i]
            next_score_i[i] = last_i
            next_event[i] = last_ev
            next_scorer[i] = last_sc

        for i in range(n):
            # Label is for the state *before* this play's outcome; still uses future scores
            # including a score on this same play (standard next-score-in-half).
            if next_score_i[i] < 0:
                labels.iloc[g_idx[i]] = "NoScore"
                continue
            cls = class_from_scorer(
                None if pd.isna(g_posteam[i]) else str(g_posteam[i]),
                None if next_scorer[i] is None or pd.isna(next_scorer[i]) else str(next_scorer[i]),
                str(next_event[i]),
            )
            if cls in EP_CLASSES:
                labels.iloc[g_idx[i]] = cls

    # Reindex to original order if caller didn't sort — we sorted/reset, so return with
    # a key join on game_id/play_id for safety when original index mattered.
    out = pd.Series(pd.NA, index=pbp.index, dtype="string")
    key = pbp[["game_id", "play_id"]].copy()
    key["_i"] = np.arange(len(key))
    lab_df = df[["game_id", "play_id"]].copy()
    lab_df["label"] = labels.to_numpy()
    merged = key.merge(lab_df, on=["game_id", "play_id"], how="left")
    out.iloc[merged["_i"].to_numpy()] = merged["label"].to_numpy()
    return out.astype("string")


def eligible_mask(pbp: pd.DataFrame, labels: pd.Series) -> pd.Series:
    """REG scrimmage rows with required pre-play fields + valid label."""
    season_type = pbp["season_type"].astype("string") if "season_type" in pbp.columns else pd.Series("REG", index=pbp.index)
    down = pd.to_numeric(pbp["down"], errors="coerce")
    distance = pd.to_numeric(pbp["ydstogo"], errors="coerce")
    y100 = pd.to_numeric(pbp["yardline_100"], errors="coerce")
    half = pd.to_numeric(pbp["half_seconds_remaining"], errors="coerce")
    posteam = pbp["posteam"]
    home = pbp["home_team"]
    return (
        season_type.eq("REG")
        & down.notna()
        & distance.notna()
        & y100.notna()
        & half.notna()
        & posteam.notna()
        & home.notna()
        & labels.notna()
        & labels.isin(list(EP_CLASSES))
    )
