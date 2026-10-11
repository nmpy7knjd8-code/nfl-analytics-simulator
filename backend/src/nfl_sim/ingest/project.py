"""Project nflverse PBP rows → canonical games + plays DataFrames."""

from __future__ import annotations

import numpy as np
import pandas as pd

from nfl_sim.ingest.derive import derive_is_home_possession, derive_receive_2h_ko
from nfl_sim.ingest.play_types import map_play_type


def _nullable_int(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").astype("Int64")


def _nullable_float(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").astype("Float64")


def _nullable_str(series: pd.Series) -> pd.Series:
    out = series.astype("string")
    return out.where(out.notna() & (out != "") & (out.str.lower() != "nan"), pd.NA)


def project_games(pbp: pd.DataFrame) -> pd.DataFrame:
    """One row per game_id from season PBP."""
    if pbp.empty:
        return pd.DataFrame(
            columns=[
                "game_id",
                "league",
                "season",
                "week",
                "season_type",
                "game_type",
                "game_date",
                "home_team_id",
                "away_team_id",
                "roof",
                "surface",
                "stadium",
                "home_opening_kickoff",
                "home_score",
                "away_score",
                "truth_label",
            ]
        )

    # Final scores: last non-null home/away score columns if present
    sort_cols = ["game_id"]
    if "play_id" in pbp.columns:
        sort_cols.append("play_id")
    ordered = pbp.sort_values(sort_cols, kind="mergesort")

    agg: dict[str, str] = {
        "season": "first",
        "week": "first",
        "season_type": "first",
        "game_date": "first",
        "home_team": "first",
        "away_team": "first",
    }
    for optional in ("game_type", "roof", "surface", "stadium", "home_opening_kickoff"):
        if optional in ordered.columns:
            agg[optional] = "first"
    for score_col in ("home_score", "away_score", "total_home_score", "total_away_score"):
        if score_col in ordered.columns:
            agg[score_col] = "last"

    games = ordered.groupby("game_id", sort=True).agg(agg).reset_index()

    home_score = None
    if "home_score" in games.columns:
        home_score = _nullable_int(games["home_score"])
    elif "total_home_score" in games.columns:
        home_score = _nullable_int(games["total_home_score"])

    away_score = None
    if "away_score" in games.columns:
        away_score = _nullable_int(games["away_score"])
    elif "total_away_score" in games.columns:
        away_score = _nullable_int(games["total_away_score"])

    out = pd.DataFrame(
        {
            "game_id": _nullable_str(games["game_id"]),
            "league": "NFL",
            "season": _nullable_int(games["season"]),
            "week": _nullable_int(games["week"]),
            "season_type": _nullable_str(games["season_type"]),
            "game_type": _nullable_str(games["game_type"]) if "game_type" in games.columns else pd.NA,
            "game_date": _nullable_str(games["game_date"]),
            "home_team_id": _nullable_str(games["home_team"]),
            "away_team_id": _nullable_str(games["away_team"]),
            "roof": _nullable_str(games["roof"]) if "roof" in games.columns else pd.NA,
            "surface": _nullable_str(games["surface"]) if "surface" in games.columns else pd.NA,
            "stadium": _nullable_str(games["stadium"]) if "stadium" in games.columns else pd.NA,
            "home_opening_kickoff": (
                _nullable_int(games["home_opening_kickoff"])
                if "home_opening_kickoff" in games.columns
                else pd.Series(pd.NA, index=games.index, dtype="Int64")
            ),
            "home_score": home_score if home_score is not None else pd.Series(pd.NA, index=games.index, dtype="Int64"),
            "away_score": away_score if away_score is not None else pd.Series(pd.NA, index=games.index, dtype="Int64"),
            "truth_label": "historical",
        }
    )
    return out.sort_values(["season", "week", "game_id"], kind="mergesort").reset_index(drop=True)


def project_plays(pbp: pd.DataFrame) -> pd.DataFrame:
    """Canonical play rows ordered by game_id, play_id."""
    if pbp.empty:
        return pd.DataFrame()

    df = pbp.copy()
    df = df.sort_values(["game_id", "play_id"], kind="mergesort").reset_index(drop=True)
    play_index = df.groupby("game_id", sort=False).cumcount()

    is_home = derive_is_home_possession(df["posteam"], df["home_team"])
    receive_2h = derive_receive_2h_ko(df)

    # PlayType is str Enum — map directly to .value (pandas may coerce Enum→str)
    play_types = df["play_type"].map(lambda x: map_play_type(x).value)

    # Scoring / turnover heuristics from common nflverse flags when present
    is_scoring = pd.Series(False, index=df.index)
    if "sp" in df.columns:
        is_scoring = pd.to_numeric(df["sp"], errors="coerce").fillna(0).astype(int).eq(1)
    elif "touchdown" in df.columns:
        is_scoring = pd.to_numeric(df["touchdown"], errors="coerce").fillna(0).astype(int).eq(1)

    is_turnover = pd.Series(False, index=df.index)
    for col in ("interception", "fumble_lost"):
        if col in df.columns:
            is_turnover = is_turnover | pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int).eq(1)

    out = pd.DataFrame(
        {
            "play_id": _nullable_str(df["play_id"].astype(str)),
            "game_id": _nullable_str(df["game_id"]),
            "play_index": play_index.astype("int64"),
            "quarter": _nullable_int(df["qtr"]),
            "half_seconds_remaining": _nullable_int(df["half_seconds_remaining"]),
            "game_seconds_remaining": _nullable_int(df["game_seconds_remaining"]),
            "down": _nullable_int(df["down"]),
            "distance": _nullable_int(df["ydstogo"]),
            "yardline_100": _nullable_int(df["yardline_100"]),
            "possession_team_id": _nullable_str(df["posteam"]),
            "defense_team_id": _nullable_str(df["defteam"]),
            "is_home_possession": is_home,
            "score_differential": _nullable_int(df["score_differential"]),
            "posteam_score": _nullable_int(df["posteam_score"]),
            "defteam_score": _nullable_int(df["defteam_score"]),
            "posteam_timeouts": _nullable_int(df["posteam_timeouts_remaining"]),
            "defteam_timeouts": _nullable_int(df["defteam_timeouts_remaining"]),
            "roof": _nullable_str(df["roof"]) if "roof" in df.columns else pd.NA,
            "receive_2h_ko": receive_2h,
            "play_type": play_types,
            "description": _nullable_str(df["desc"]) if "desc" in df.columns else pd.NA,
            "yards_gained": _nullable_float(df["yards_gained"]) if "yards_gained" in df.columns else pd.NA,
            "score_differential_post": _nullable_int(df["score_differential_post"])
            if "score_differential_post" in df.columns
            else pd.NA,
            "posteam_score_post": _nullable_int(df["posteam_score_post"])
            if "posteam_score_post" in df.columns
            else pd.NA,
            "defteam_score_post": _nullable_int(df["defteam_score_post"])
            if "defteam_score_post" in df.columns
            else pd.NA,
            "fixed_drive": _nullable_int(df["fixed_drive"]) if "fixed_drive" in df.columns else pd.NA,
            "fixed_drive_result": _nullable_str(df["fixed_drive_result"])
            if "fixed_drive_result" in df.columns
            else pd.NA,
            "is_scoring_play": is_scoring,
            "is_turnover": is_turnover,
            # Reference namespace (flattened for Parquet; API re-nests)
            "reference_ep": _nullable_float(df["ep"]) if "ep" in df.columns else pd.NA,
            "reference_epa": _nullable_float(df["epa"]) if "epa" in df.columns else pd.NA,
            "reference_wp": _nullable_float(df["wp"]) if "wp" in df.columns else pd.NA,
            "reference_wpa": _nullable_float(df["wpa"]) if "wpa" in df.columns else pd.NA,
            "reference_vegas_wp": _nullable_float(df["vegas_wp"]) if "vegas_wp" in df.columns else pd.NA,
            "reference_vegas_wpa": _nullable_float(df["vegas_wpa"]) if "vegas_wpa" in df.columns else pd.NA,
            "reference_home_wp": _nullable_float(df["home_wp"]) if "home_wp" in df.columns else pd.NA,
            "reference_away_wp": _nullable_float(df["away_wp"]) if "away_wp" in df.columns else pd.NA,
            "reference_cp": _nullable_float(df["cp"]) if "cp" in df.columns else pd.NA,
            "reference_success": _nullable_float(df["success"]) if "success" in df.columns else pd.NA,
            "truth_label": "historical",
            "split": _split_flag(df["season"]),
        }
    )
    # Preserve missingness: do not fill yardline/down with invented values
    return out


def _split_flag(season: pd.Series) -> pd.Series:
    s = pd.to_numeric(season, errors="coerce")
    out = pd.Series(pd.NA, index=season.index, dtype="string")
    out.loc[s.isin([2019, 2020, 2021])] = "train"
    out.loc[s == 2022] = "val"
    out.loc[s == 2023] = "test"
    return out


def play_row_to_api_dict(row: pd.Series | dict) -> dict:
    """Nest reference_* columns into CanonicalPlay-shaped dict."""
    r = row if isinstance(row, dict) else row.to_dict()

    def _none(v):
        if v is None:
            return None
        if isinstance(v, float) and (np.isnan(v) or pd.isna(v)):
            return None
        if pd.isna(v):
            return None
        if hasattr(v, "item"):
            try:
                return v.item()
            except Exception:
                pass
        return v

    def _bool(v):
        x = _none(v)
        if x is None:
            return None
        return bool(x)

    return {
        "play_id": str(r["play_id"]),
        "game_id": str(r["game_id"]),
        "play_index": int(r["play_index"]),
        "quarter": int(r["quarter"]) if _none(r.get("quarter")) is not None else None,
        "half_seconds_remaining": _none(r.get("half_seconds_remaining")),
        "game_seconds_remaining": _none(r.get("game_seconds_remaining")),
        "down": _none(r.get("down")),
        "distance": _none(r.get("distance")),
        "yardline_100": _none(r.get("yardline_100")),
        "possession_team_id": _none(r.get("possession_team_id")),
        "defense_team_id": _none(r.get("defense_team_id")),
        "is_home_possession": _bool(r.get("is_home_possession")),
        "score_differential": _none(r.get("score_differential")),
        "posteam_score": _none(r.get("posteam_score")),
        "defteam_score": _none(r.get("defteam_score")),
        "posteam_timeouts": _none(r.get("posteam_timeouts")),
        "defteam_timeouts": _none(r.get("defteam_timeouts")),
        "roof": _none(r.get("roof")),
        "receive_2h_ko": _none(r.get("receive_2h_ko")),
        "play_type": r.get("play_type") or "other",
        "description": _none(r.get("description")),
        "yards_gained": _none(r.get("yards_gained")),
        "score_differential_post": _none(r.get("score_differential_post")),
        "posteam_score_post": _none(r.get("posteam_score_post")),
        "defteam_score_post": _none(r.get("defteam_score_post")),
        "fixed_drive": _none(r.get("fixed_drive")),
        "fixed_drive_result": _none(r.get("fixed_drive_result")),
        "is_scoring_play": bool(_none(r.get("is_scoring_play")) or False),
        "is_turnover": bool(_none(r.get("is_turnover")) or False),
        "reference": {
            "ep": _none(r.get("reference_ep")),
            "epa": _none(r.get("reference_epa")),
            "wp": _none(r.get("reference_wp")),
            "wpa": _none(r.get("reference_wpa")),
            "vegas_wp": _none(r.get("reference_vegas_wp")),
            "vegas_wpa": _none(r.get("reference_vegas_wpa")),
            "home_wp": _none(r.get("reference_home_wp")),
            "away_wp": _none(r.get("reference_away_wp")),
            "cp": _none(r.get("reference_cp")),
            "success": _none(r.get("reference_success")),
        },
        "truth_label": r.get("truth_label") or "historical",
    }
