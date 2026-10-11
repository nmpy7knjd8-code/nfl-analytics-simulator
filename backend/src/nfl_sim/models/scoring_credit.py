"""EPA scoring-credit conventions and diagnostics (Task A / D015).

Convention A = legacy Stage A formulas (no realized next-score cash) — diagnostic only.
Convention B = production (``epa.py``): A base plus next-score class value R on the
scoring play (snap posteam perspective; XP/2PT excluded, R=0).

Never loads season 2023.
"""

from __future__ import annotations

from typing import Any, Literal

import numpy as np
import pandas as pd

from nfl_sim.models.constants import EP_CLASS_VALUES
from nfl_sim.models.epa import attach_post_state, model_epa_from_eps
from nfl_sim.models.labels import _event_type, _flag, _is_try_row, scoring_event_team

DIAGNOSTIC_SEASONS: tuple[int, ...] = (2019, 2020, 2021, 2022)
HOLDOUT_SEASON: int = 2023

OutcomeBucket = Literal[
    "td_offense",
    "td_defense_or_return",
    "fg_made",
    "safety",
    "punt",
    "turnover_non_score",
    "turnover_on_downs",
    "timeout",
    "terminal_no_score",
    "same_possession_other",
    "possession_change_other",
    "excluded_try_or_admin",
    "other",
]


def forbid_holdout(seasons: list[int] | tuple[int, ...] | set[int], *, context: str) -> None:
    if HOLDOUT_SEASON in {int(s) for s in seasons}:
        raise ValueError(f"{context}: season {HOLDOUT_SEASON} is sealed for Task A diagnostics")


def realized_next_score_value(df: pd.DataFrame) -> pd.Series:
    """Next-score class value R realized **on this row**, else 0.

    Uses event flags + scoring team (not posteam alone). Tries → 0.
    Values from ``EP_CLASS_VALUES`` only ({+7,+3,+2,0,-2,-3,-7}).
    """
    idx = df.index
    is_try = _is_try_row(df, idx)
    is_td = _flag(df["touchdown"] if "touchdown" in df.columns else None, idx) & ~is_try
    is_safety = _flag(df["safety"] if "safety" in df.columns else None, idx) & ~is_try
    fg_made = pd.Series(False, index=idx)
    if "field_goal_result" in df.columns:
        fg_made = (
            df["field_goal_result"].astype("string").str.lower().eq("made").fillna(False).astype(bool)
        )
    fg_made = fg_made & ~is_try
    scorers = scoring_event_team(df)
    posteam = (
        df["posteam"].astype("string")
        if "posteam" in df.columns
        else pd.Series(pd.NA, index=idx, dtype="string")
    )

    out = np.zeros(len(df), dtype=float)
    for i, gi in enumerate(idx):
        if bool(is_try.loc[gi]):
            continue
        ev = _event_type(bool(is_td.loc[gi]), bool(is_safety.loc[gi]), bool(fg_made.loc[gi]))
        if ev is None:
            continue
        p = posteam.loc[gi]
        s = scorers.loc[gi]
        if pd.isna(p) or pd.isna(s):
            continue
        same = str(s) == str(p)
        if ev == "Touchdown":
            cls = "Touchdown" if same else "OppTouchdown"
        elif ev == "FieldGoal":
            cls = "FieldGoal" if same else "OppFieldGoal"
        elif ev == "Safety":
            # scoring_event_team credits defteam; from posteam that is OppSafety when same!= 
            # Safety points go to defense on the row → for posteam always OppSafety unless
            # posteam == scorer (should not happen with current scorer rule).
            cls = "Safety" if same else "OppSafety"
        else:
            continue
        out[i] = float(EP_CLASS_VALUES[cls])
    return pd.Series(out, index=idx, dtype=float)


def convention_a_epa(
    ep_before: np.ndarray,
    ep_after_raw: np.ndarray,
    *,
    possession_change: np.ndarray,
    is_timeout: np.ndarray,
    is_terminal: np.ndarray,
) -> np.ndarray:
    """Legacy Stage A formulas (no ``realized_r`` overlay) — diagnostic only."""
    return model_epa_from_eps(
        ep_before,
        ep_after_raw,
        possession_change=possession_change,
        is_timeout=is_timeout,
        is_terminal=is_terminal,
        realized_r=None,
    )


def convention_b_epa(
    ep_before: np.ndarray,
    ep_after_raw: np.ndarray,
    *,
    possession_change: np.ndarray,
    is_timeout: np.ndarray,
    is_terminal: np.ndarray,
    realized_r: np.ndarray,
) -> np.ndarray:
    """Reference-EPA-B (nflfastR-style overlays on the same EP surface).

    Non-score / non-timeout: same base as Convention A (ΔEP with PC sign-flip /
    terminal ``-ep``). Scoring plays **override** to ``R - ep_before`` where R is
    the next-score class value on that row ({±7,±3,±2}); try & kickoff are
    separate rows (R=0 here). See REFERENCE_IMPLEMENTATION_RECON Addendum A.

    This is **not** ``A + R`` (which would keep ``-ep_after`` on score+PC).
    """
    base = convention_a_epa(
        ep_before,
        ep_after_raw,
        possession_change=possession_change,
        is_timeout=is_timeout,
        is_terminal=is_terminal,
    )
    eb = np.asarray(ep_before, dtype=float)
    r = np.asarray(realized_r, dtype=float)
    to = np.asarray(is_timeout, dtype=bool)
    out = base.copy()
    scored = (~to) & (np.abs(r) > 0.0)
    out[scored] = r[scored] - eb[scored]
    return out


def _flag_val(v: object) -> bool:
    x = pd.to_numeric(v, errors="coerce")
    if v is None or (isinstance(x, float) and np.isnan(x)) or pd.isna(x):
        return False
    return int(x) == 1


def classify_outcome_row(row: pd.Series, *, r: float) -> OutcomeBucket:
    play_type = str(row.get("play_type") or "").lower()
    if play_type in {
        "extra_point",
        "extra_point_attempt",
        "two_point_attempt",
        "two_point_conversion",
        "xp_kick",
    }:
        return "excluded_try_or_admin"
    down = row.get("down")
    if down is None or (isinstance(down, float) and np.isnan(down)):
        if play_type in {"kickoff", "onside_kick", "free_kick"}:
            return "excluded_try_or_admin"
        return "excluded_try_or_admin"

    is_to = bool(row.get("epa_is_timeout", False))
    is_term = bool(row.get("epa_is_terminal", False))
    pc = bool(row.get("epa_possession_change", False))
    is_td = _flag_val(row.get("touchdown"))
    is_safety = _flag_val(row.get("safety"))
    fg = str(row.get("field_goal_result") or "").lower() == "made"
    interception = _flag_val(row.get("interception"))
    fumble_lost = _flag_val(row.get("fumble_lost"))
    tod = _flag_val(row.get("fourth_down_failed"))
    punt = _flag_val(row.get("punt_attempt")) or play_type == "punt"

    if is_to:
        return "timeout"
    if abs(r) == 7.0 and r > 0:
        return "td_offense"
    if abs(r) == 7.0 and r < 0:
        return "td_defense_or_return"
    if abs(r) == 3.0:
        return "fg_made"
    if abs(r) == 2.0:
        return "safety"
    if is_term and abs(r) < 1e-12:
        return "terminal_no_score"
    if punt and not (is_td or is_safety or fg):
        return "punt"
    if tod and not (is_td or is_safety or fg):
        return "turnover_on_downs"
    if (interception or fumble_lost) and not (is_td or is_safety or fg):
        return "turnover_non_score"
    if pc:
        return "possession_change_other"
    return "same_possession_other"


def _vectorized_outcome_buckets(m: pd.DataFrame) -> np.ndarray:
    """Fast outcome labels for eligible scrimmage rows."""
    n = len(m)
    out = np.full(n, "other", dtype=object)
    r = pd.to_numeric(m["realized_r"], errors="coerce").fillna(0.0).to_numpy(dtype=float)
    play_type = m["play_type"].astype("string").str.lower().fillna("") if "play_type" in m.columns else pd.Series([""] * n)
    is_to = m["epa_is_timeout"].fillna(False).to_numpy(dtype=bool) if "epa_is_timeout" in m.columns else np.zeros(n, dtype=bool)
    is_term = m["epa_is_terminal"].fillna(False).to_numpy(dtype=bool) if "epa_is_terminal" in m.columns else np.zeros(n, dtype=bool)
    pc = m["epa_possession_change"].fillna(False).to_numpy(dtype=bool) if "epa_possession_change" in m.columns else np.zeros(n, dtype=bool)
    interception = _flag(m["interception"] if "interception" in m.columns else None, m.index).to_numpy()
    fumble_lost = _flag(m["fumble_lost"] if "fumble_lost" in m.columns else None, m.index).to_numpy()
    tod = _flag(m["fourth_down_failed"] if "fourth_down_failed" in m.columns else None, m.index).to_numpy()
    punt_flag = _flag(m["punt_attempt"] if "punt_attempt" in m.columns else None, m.index).to_numpy()
    punt = punt_flag | play_type.eq("punt").to_numpy()

    out[is_to] = "timeout"
    out[(np.abs(r) == 7.0) & (r > 0)] = "td_offense"
    out[(np.abs(r) == 7.0) & (r < 0)] = "td_defense_or_return"
    out[np.abs(r) == 3.0] = "fg_made"
    out[np.abs(r) == 2.0] = "safety"
    scored = np.abs(r) > 0
    out[is_term & ~scored & (out == "other")] = "terminal_no_score"
    out[punt & ~scored & (out == "other")] = "punt"
    out[tod & ~scored & (out == "other")] = "turnover_on_downs"
    out[(interception | fumble_lost) & ~scored & (out == "other")] = "turnover_non_score"
    out[pc & (out == "other")] = "possession_change_other"
    out[~pc & ~is_term & ~is_to & (out == "other")] = "same_possession_other"
    return out


def _slice_stats(
    model_or_conv: np.ndarray,
    ref: np.ndarray,
    mask: np.ndarray,
) -> dict[str, Any]:
    m = np.asarray(mask, dtype=bool)
    n = int(m.sum())
    if n == 0:
        return {
            "n": 0,
            "mean_conv": None,
            "mean_ref": None,
            "mean_signed_diff": None,
            "mae": None,
            "median_ae": None,
            "pct_negative_conv": None,
            "pct_negative_ref": None,
        }
    c = model_or_conv[m]
    r = ref[m]
    ae = np.abs(c - r)
    return {
        "n": n,
        "mean_conv": float(np.mean(c)),
        "mean_ref": float(np.mean(r)),
        "mean_signed_diff": float(np.mean(c - r)),
        "mae": float(np.mean(ae)),
        "median_ae": float(np.median(ae)),
        "pct_negative_conv": float(np.mean(c < 0.0) * 100.0),
        "pct_negative_ref": float(np.mean(r < 0.0) * 100.0),
    }


def score_conventions_from_ep_surface(
    pbp: pd.DataFrame,
    *,
    ep_col: str = "ep",
) -> pd.DataFrame:
    """Attach Convention A/B EPA using an EP column as the EP surface.

    Used when the project joblib is unavailable: nflverse ``ep`` isolates the
    transition convention from project model fit. Does not train or alter models.
    """
    if "season" in pbp.columns:
        forbid_holdout(pbp["season"].dropna().unique().tolist(), context="score_conventions_from_ep_surface")
    framed = attach_post_state(pbp)
    ep_before = pd.to_numeric(framed[ep_col], errors="coerce").to_numpy(dtype=float)
    # Next-scrimmage EP from same surface (posteam perspective at next snap)
    ep_after = np.full(len(framed), np.nan, dtype=float)
    # Map next play's ep via game_id/play_id join on framed order within half links
    # attach_post_state already found next scrimmage index semantics via columns;
    # recover next EP by aligning on epa_next_* state — use shifted ep within framed
    # by matching next posteam row's ep: build lookup from (game_id, play_id)->ep then
    # find next scrimmage play_id.
    framed = framed.copy()
    framed["_ep_surface"] = ep_before
    # Recompute next ep by scanning like attach_post_state
    down = pd.to_numeric(framed["down"], errors="coerce")
    from nfl_sim.models.labels import half_bucket

    hb = half_bucket(framed["qtr"] if "qtr" in framed.columns else pd.Series(pd.NA, index=framed.index))
    framed["_half"] = hb
    ep_after_s = pd.Series(np.nan, index=framed.index, dtype=float)
    for _, group in framed.groupby(["game_id", "_half"], sort=False, dropna=True):
        idx = group.index.to_numpy()
        g_down = down.loc[group.index].to_numpy()
        g_ep = group["_ep_surface"].to_numpy(dtype=float)
        n = len(idx)
        next_scrim = np.full(n, -1, dtype=int)
        last = -1
        for i in range(n - 1, -1, -1):
            next_scrim[i] = last
            if not np.isnan(g_down[i]):
                last = i
        for i in range(n):
            j = next_scrim[i]
            if j >= 0:
                ep_after_s.loc[idx[i]] = g_ep[j]
    ep_after = ep_after_s.to_numpy(dtype=float)
    # For terminal rows ep_after unused; fill 0 for vectorized path
    ep_after_filled = np.where(np.isnan(ep_after), 0.0, ep_after)

    r = realized_next_score_value(framed).to_numpy(dtype=float)
    pc = framed["epa_possession_change"].fillna(False).to_numpy(dtype=bool)
    to = framed["epa_is_timeout"].fillna(False).to_numpy(dtype=bool)
    term = framed["epa_is_terminal"].fillna(False).to_numpy(dtype=bool)

    # Valid EP before required
    valid_ep = np.isfinite(ep_before)

    conv_a = convention_a_epa(ep_before, ep_after_filled, possession_change=pc, is_timeout=to, is_terminal=term)
    conv_b = convention_b_epa(
        ep_before,
        ep_after_filled,
        possession_change=pc,
        is_timeout=to,
        is_terminal=term,
        realized_r=r,
    )
    # Invalidate where ep_before missing, or non-terminal missing ep_after
    bad = (~valid_ep) | ((~term) & (~to) & ~np.isfinite(ep_after))
    conv_a = conv_a.astype(float)
    conv_b = conv_b.astype(float)
    conv_a[bad] = np.nan
    conv_b[bad] = np.nan

    out = framed.drop(columns=["_half", "_ep_surface"], errors="ignore")
    out["ep_before_surface"] = ep_before
    out["ep_after_surface"] = ep_after
    out["realized_r"] = r
    out["convention_a_epa"] = conv_a
    out["convention_b_epa"] = conv_b
    out["reference_epa"] = pd.to_numeric(out["epa"], errors="coerce") if "epa" in out.columns else np.nan
    return out


def outcome_table(scored: pd.DataFrame) -> dict[str, Any]:
    """Build outcome-level comparison table for Conventions A/B vs reference EPA."""
    if "season" in scored.columns:
        forbid_holdout(scored["season"].dropna().unique().tolist(), context="outcome_table")

    # Eligible: REG scrimmage with non-null down and reference epa
    season_type = (
        scored["season_type"].astype("string")
        if "season_type" in scored.columns
        else pd.Series("REG", index=scored.index)
    )
    down = pd.to_numeric(scored["down"], errors="coerce")
    ref = pd.to_numeric(scored["reference_epa"], errors="coerce")
    a = pd.to_numeric(scored["convention_a_epa"], errors="coerce")
    b = pd.to_numeric(scored["convention_b_epa"], errors="coerce")
    eligible = season_type.eq("REG") & down.notna() & ref.notna() & a.notna() & b.notna()
    m = scored.loc[eligible].copy()
    if m.empty:
        return {"n_eligible": 0, "buckets": {}, "exclusions": {}}

    m = m.assign(outcome_bucket=_vectorized_outcome_buckets(m))

    ref_v = m["reference_epa"].to_numpy(dtype=float)
    a_v = m["convention_a_epa"].to_numpy(dtype=float)
    b_v = m["convention_b_epa"].to_numpy(dtype=float)

    out_buckets: dict[str, Any] = {}
    for name in sorted(m["outcome_bucket"].unique()):
        mask = (m["outcome_bucket"] == name).to_numpy()
        out_buckets[name] = {
            "convention_a": _slice_stats(a_v, ref_v, mask),
            "convention_b": _slice_stats(b_v, ref_v, mask),
        }

    # Focused TD/FG negativity (offense)
    for focus in ("td_offense", "fg_made"):
        mask = (m["outcome_bucket"] == focus).to_numpy()
        if mask.any():
            out_buckets[focus]["pct_negative_epa_on_score"] = {
                "convention_a": float(np.mean(a_v[mask] < 0) * 100),
                "convention_b": float(np.mean(b_v[mask] < 0) * 100),
                "reference": float(np.mean(ref_v[mask] < 0) * 100),
            }

    excl = scored.loc[~eligible]
    excl_reasons = {
        "n_total_rows": int(len(scored)),
        "n_eligible": int(len(m)),
        "n_non_reg_or_null_down_or_missing_epa": int((~eligible).sum()),
        "seasons": sorted(int(x) for x in m["season"].dropna().unique()) if "season" in m.columns else [],
        "holdout_2023_loaded": bool(
            "season" in scored.columns and (pd.to_numeric(scored["season"], errors="coerce") == HOLDOUT_SEASON).any()
        ),
    }
    return {
        "ep_surface": "nflverse_ep_column",
        "n_eligible": int(len(m)),
        "buckets": out_buckets,
        "exclusions": excl_reasons,
        "overall": {
            "convention_a": _slice_stats(a_v, ref_v, np.ones(len(m), dtype=bool)),
            "convention_b": _slice_stats(b_v, ref_v, np.ones(len(m), dtype=bool)),
        },
    }


def score_credit_identity_residuals(
    scored: pd.DataFrame,
    *,
    atol: float = 1e-9,
    continuity_atol: float = 1e-6,
) -> dict[str, Any]:
    """Check ``Σ Convention-B EPA = R_end − EP0`` on contiguous same-poss epochs.

    Convention B = nflfastR overlays: non-score uses Stage A ΔEP; score → ``R − ep``.
    Only chains where each non-final play has ``ep_after ≈ next ep_before`` and no
    possession-change until the closing score/terminal are checked.
    """
    if "season" in scored.columns:
        forbid_holdout(scored["season"].dropna().unique().tolist(), context="score_credit_identity")

    df = scored.sort_values(["game_id", "play_id"], kind="mergesort").copy()
    down = pd.to_numeric(df["down"], errors="coerce")
    from nfl_sim.models.labels import half_bucket

    df["_half"] = half_bucket(df["qtr"] if "qtr" in df.columns else pd.Series(pd.NA, index=df.index))

    epoch_ok = 0
    epoch_fail = 0
    skipped = 0
    epoch_fail_examples: list[dict[str, Any]] = []
    residuals: list[float] = []
    intervals = 0

    for _, g in df.groupby(["game_id", "_half"], sort=False, dropna=True):
        positions = list(g.index)
        k = 0
        while k < len(positions):
            gi = positions[k]
            if pd.isna(down.loc[gi]) or bool(g.loc[gi, "epa_is_timeout"]):
                k += 1
                continue
            ep0 = float(g.loc[gi, "ep_before_surface"])
            if not np.isfinite(ep0):
                k += 1
                continue

            chain: list[Any] = []
            r_end = 0.0
            end_k = k
            continuous = True
            for j in range(k, len(positions)):
                gj = positions[j]
                if pd.isna(down.loc[gj]):
                    continue
                if bool(g.loc[gj, "epa_is_timeout"]):
                    continuous = False
                    break
                # Possession change before epoch close breaks telescoping in posteam units
                r_j = float(g.loc[gj, "realized_r"])
                term = bool(g.loc[gj, "epa_is_terminal"])
                pc = bool(g.loc[gj, "epa_possession_change"])
                if chain and abs(r_j) < 1e-12 and not term and pc:
                    continuous = False
                    break
                if chain:
                    prev = chain[-1]
                    ea_prev = g.loc[prev, "ep_after_surface"]
                    eb_cur = g.loc[gj, "ep_before_surface"]
                    if pd.isna(ea_prev) or not np.isfinite(float(eb_cur)):
                        continuous = False
                        break
                    if abs(float(ea_prev) - float(eb_cur)) > continuity_atol:
                        continuous = False
                        break
                chain.append(gj)
                end_k = j
                if abs(r_j) > 0:
                    r_end = r_j
                    break
                if term:
                    r_end = 0.0
                    break
                if pc:
                    # non-score PC — not in this identity coverage
                    continuous = False
                    break
            else:
                continuous = False

            if not continuous or not chain:
                skipped += 1
                k += 1
                continue

            epa_vals = pd.to_numeric(g.loc[chain, "convention_b_epa"], errors="coerce").to_numpy(dtype=float)
            if not np.isfinite(epa_vals).all():
                skipped += 1
                k = end_k + 1
                continue
            epa_sum = float(epa_vals.sum())
            expected = r_end - ep0
            resid = epa_sum - expected
            intervals += 1
            residuals.append(resid)
            if abs(resid) < atol:
                epoch_ok += 1
            else:
                epoch_fail += 1
                if len(epoch_fail_examples) < 15:
                    epoch_fail_examples.append(
                        {
                            "game_id": str(g.loc[chain[0], "game_id"]),
                            "start_play_id": int(g.loc[chain[0], "play_id"]),
                            "end_play_id": int(g.loc[chain[-1], "play_id"]),
                            "residual": float(resid),
                            "epa_sum": float(epa_sum),
                            "expected": float(expected),
                            "r_end": float(r_end),
                            "ep0": float(ep0),
                        }
                    )
            k = end_k + 1

    res = np.asarray(residuals, dtype=float) if residuals else np.asarray([], dtype=float)
    return {
        "identity": "sum_convention_B_EPA = R_end - EP_before_start (nflfastR score overlay)",
        "atol": atol,
        "intervals_checked": intervals,
        "skipped_non_contiguous_or_pc": skipped,
        "epoch_form": {"ok": epoch_ok, "fail": epoch_fail, "pass": epoch_fail == 0},
        "epoch_fail_examples": epoch_fail_examples,
        "residual_summary": {
            "n": int(res.size),
            "max_abs": float(np.max(np.abs(res))) if res.size else None,
            "mean_abs": float(np.mean(np.abs(res))) if res.size else None,
            "frac_abs_lt_atol": float(np.mean(np.abs(res) < atol)) if res.size else None,
        },
        "exclusions": [
            "timeouts",
            "non-score possession-change intervals",
            "discontinuous ep_after→ep_before links",
            "null-down admin-only starts",
            "2023 holdout",
        ],
    }
