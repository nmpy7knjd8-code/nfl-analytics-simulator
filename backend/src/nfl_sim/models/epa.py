"""Deterministic EPA from model EP — docs/EP_MODEL_SPEC.md §6."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd

from nfl_sim.models.features import build_feature_frame


EpaCase = Literal[
    "timeout",
    "terminal",
    "same_possession",
    "possession_change",
]


@dataclass(frozen=True)
class EpaResult:
    model_epa: float
    case: EpaCase
    ep_before: float
    ep_after_for_original: float


def compute_epa(
    ep_before: float,
    *,
    ep_after_raw: float | None,
    possession_change: bool,
    is_timeout: bool,
    is_terminal: bool,
) -> EpaResult:
    """Possession-aware EPA (no naïve subtraction across possession change)."""
    eb = float(ep_before)
    if is_timeout:
        return EpaResult(0.0, "timeout", eb, eb)
    if is_terminal or ep_after_raw is None:
        return EpaResult(-eb, "terminal", eb, 0.0)
    ea = float(ep_after_raw)
    if possession_change:
        return EpaResult((-ea) - eb, "possession_change", eb, -ea)
    return EpaResult(ea - eb, "same_possession", eb, ea)


def _is_timeout_row(play_type: object) -> bool:
    if play_type is None or (isinstance(play_type, float) and np.isnan(play_type)):
        return False
    return str(play_type).lower() in {"timeout", "no_play_timeout"}


def attach_post_state(pbp: pd.DataFrame) -> pd.DataFrame:
    """Add next-scrimmage post-state columns for EPA transitions."""
    df = pbp.sort_values(["game_id", "play_id"], kind="mergesort").copy()
    down = pd.to_numeric(df["down"], errors="coerce")

    next_down = pd.Series(pd.NA, index=df.index, dtype="Float64")
    next_distance = pd.Series(pd.NA, index=df.index, dtype="Float64")
    next_y100 = pd.Series(pd.NA, index=df.index, dtype="Float64")
    next_half = pd.Series(pd.NA, index=df.index, dtype="Float64")
    next_pot = pd.Series(pd.NA, index=df.index, dtype="Float64")
    next_dot = pd.Series(pd.NA, index=df.index, dtype="Float64")
    next_home = pd.Series(pd.NA, index=df.index, dtype="Float64")
    next_era = pd.Series(pd.NA, index=df.index, dtype="Float64")
    next_roof = pd.Series(pd.NA, index=df.index, dtype="string")
    next_posteam = pd.Series(pd.NA, index=df.index, dtype="string")
    is_terminal = pd.Series(True, index=df.index)
    possession_change = pd.Series(False, index=df.index)

    pot_col = (
        "posteam_timeouts_remaining"
        if "posteam_timeouts_remaining" in df.columns
        else "posteam_timeouts"
    )
    dot_col = (
        "defteam_timeouts_remaining"
        if "defteam_timeouts_remaining" in df.columns
        else "defteam_timeouts"
    )

    for _, group in df.groupby("game_id", sort=False):
        idx = group.index.to_numpy()
        g_down = down.loc[group.index].to_numpy()
        g_posteam = group["posteam"].astype("string").to_numpy()
        n = len(idx)

        # next scrimmage index strictly after i
        next_scrim = np.full(n, -1, dtype=int)
        last = -1
        for i in range(n - 1, -1, -1):
            next_scrim[i] = last
            if not np.isnan(g_down[i]):
                last = i

        for i in range(n):
            j = next_scrim[i]
            gi = idx[i]
            if j < 0:
                is_terminal.loc[gi] = True
                continue
            is_terminal.loc[gi] = False
            gj = idx[j]
            next_down.loc[gi] = down.loc[gj]
            next_distance.loc[gi] = pd.to_numeric(df.loc[gj, "ydstogo"], errors="coerce")
            next_y100.loc[gi] = pd.to_numeric(df.loc[gj, "yardline_100"], errors="coerce")
            next_half.loc[gi] = pd.to_numeric(df.loc[gj, "half_seconds_remaining"], errors="coerce")
            if pot_col in df.columns:
                next_pot.loc[gi] = pd.to_numeric(df.loc[gj, pot_col], errors="coerce")
            if dot_col in df.columns:
                next_dot.loc[gi] = pd.to_numeric(df.loc[gj, dot_col], errors="coerce")
            next_home.loc[gi] = float(str(df.loc[gj, "posteam"]) == str(df.loc[gj, "home_team"]))
            next_era.loc[gi] = float(pd.to_numeric(df.loc[gj, "season"], errors="coerce") >= 2021)
            if "roof" in df.columns and pd.notna(df.loc[gj, "roof"]):
                next_roof.loc[gi] = str(df.loc[gj, "roof"]).lower()
            else:
                next_roof.loc[gi] = "unknown"
            next_posteam.loc[gi] = g_posteam[j]
            cur_p = g_posteam[i]
            if pd.notna(cur_p) and pd.notna(g_posteam[j]) and str(cur_p) != str(g_posteam[j]):
                possession_change.loc[gi] = True

    out = df
    out["epa_next_down"] = next_down
    out["epa_next_distance"] = next_distance
    out["epa_next_yardline_100"] = next_y100
    out["epa_next_half_seconds_remaining"] = next_half
    out["epa_next_posteam_timeouts"] = next_pot
    out["epa_next_defteam_timeouts"] = next_dot
    out["epa_next_is_home_possession"] = next_home
    out["epa_next_era_post_2020"] = next_era
    out["epa_next_roof"] = next_roof
    out["epa_next_posteam"] = next_posteam
    out["epa_is_terminal"] = is_terminal
    out["epa_possession_change"] = possession_change
    play_type = out["play_type"] if "play_type" in out.columns else pd.Series("", index=out.index)
    out["epa_is_timeout"] = play_type.map(_is_timeout_row)
    return out


def model_epa_from_eps(
    ep_before: np.ndarray | pd.Series,
    ep_after_raw: np.ndarray | pd.Series,
    *,
    possession_change: np.ndarray | pd.Series,
    is_timeout: np.ndarray | pd.Series,
    is_terminal: np.ndarray | pd.Series,
) -> np.ndarray:
    eb = np.asarray(ep_before, dtype=float)
    ea = np.asarray(ep_after_raw, dtype=float)
    pc = np.asarray(possession_change, dtype=bool)
    to = np.asarray(is_timeout, dtype=bool)
    term = np.asarray(is_terminal, dtype=bool)
    out = np.empty(len(eb), dtype=float)
    out[to] = 0.0
    mask_term = (~to) & term
    out[mask_term] = -eb[mask_term]
    mask_pc = (~to) & (~term) & pc
    out[mask_pc] = (-ea[mask_pc]) - eb[mask_pc]
    mask_same = (~to) & (~term) & (~pc)
    out[mask_same] = ea[mask_same] - eb[mask_same]
    return out


def score_model_epa(model, pbp: pd.DataFrame) -> pd.DataFrame:
    """Attach model_ep / model_epa using next-scrimmage transitions."""
    from nfl_sim.models.ep_model import EPModel

    if not isinstance(model, EPModel):
        raise TypeError("model must be EPModel")

    framed = attach_post_state(pbp)
    ep_before = model.predict_ep(framed)

    # Build a synthetic next-state frame for non-terminal rows
    next_df = pd.DataFrame(index=framed.index)
    next_df["down"] = framed["epa_next_down"]
    next_df["ydstogo"] = framed["epa_next_distance"]
    next_df["yardline_100"] = framed["epa_next_yardline_100"]
    next_df["half_seconds_remaining"] = framed["epa_next_half_seconds_remaining"]
    next_df["posteam_timeouts_remaining"] = framed["epa_next_posteam_timeouts"]
    next_df["defteam_timeouts_remaining"] = framed["epa_next_defteam_timeouts"]
    next_df["posteam"] = framed["epa_next_posteam"]
    # home_team needed for is_home — reuse current home_team
    next_df["home_team"] = framed["home_team"]
    next_df["season"] = framed["season"]
    next_df["roof"] = framed["epa_next_roof"]

    ep_after = np.zeros(len(framed), dtype=float)
    active = ~framed["epa_is_terminal"].to_numpy()
    if active.any():
        ep_after[active] = model.predict_ep(next_df.loc[active])

    model_epa = model_epa_from_eps(
        ep_before,
        ep_after,
        possession_change=framed["epa_possession_change"],
        is_timeout=framed["epa_is_timeout"],
        is_terminal=framed["epa_is_terminal"],
    )
    out = framed.copy()
    out["model_ep"] = ep_before
    out["model_ep_after_raw"] = ep_after
    out["model_epa"] = model_epa
    return out


# re-export for callers that build features on next state
__all__ = [
    "EpaResult",
    "compute_epa",
    "attach_post_state",
    "model_epa_from_eps",
    "score_model_epa",
    "build_feature_frame",
]
