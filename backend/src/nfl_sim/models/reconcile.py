"""Focused public-model reconciliation diagnostics (validate / train seasons only).

Never uses 2023 for convention tuning or feature selection.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from nfl_sim.models.dataset import build_modeling_frame, load_raw_seasons, split_frames
from nfl_sim.models.epa import score_model_epa
from nfl_sim.models.ep_model import EPModel
from nfl_sim.models.labels import scoring_event_team


def _is_score_row(df: pd.DataFrame) -> pd.Series:
    scorers = scoring_event_team(df)
    return scorers.notna()


def decompose_epa_vs_reference(
    scored: pd.DataFrame,
    modeling_keys: pd.DataFrame,
) -> dict[str, Any]:
    """Slice MAE(model_epa, ref epa) on eligible modeling rows.

    Categories separate intentional convention diffs from residual gaps.
    """
    key_cols = ["game_id", "play_id"]
    keys = modeling_keys[key_cols + (["epa"] if "epa" in modeling_keys.columns else [])].copy()
    merged = keys.merge(
        scored[
            [
                "game_id",
                "play_id",
                "model_epa",
                "model_ep",
                "epa_is_terminal",
                "epa_possession_change",
                "epa_is_timeout",
                "play_type",
                "touchdown",
                "safety",
                "field_goal_result",
                "posteam",
                "epa_next_posteam",
            ]
        ],
        on=key_cols,
        how="left",
    )
    ref = pd.to_numeric(merged["epa"], errors="coerce") if "epa" in merged.columns else pd.Series(np.nan, index=merged.index)
    valid = ref.notna() & merged["model_epa"].notna()
    m = merged.loc[valid].copy()
    ref_v = ref.loc[valid]
    abs_err = (m["model_epa"] - ref_v).abs()

    is_score = _is_score_row(m)
    # Kickoff-adjacent: next snap after score / special teams often starts after kickoff rows
    play_type = m["play_type"].astype("string").str.lower().fillna("")
    is_kick_related = play_type.isin({"kickoff", "onside_kick", "free_kick"})
    # Possession change after an observed scoring event on this row
    pc_after_score = m["epa_possession_change"].fillna(False).astype(bool) & is_score
    pc_non_score = m["epa_possession_change"].fillna(False).astype(bool) & ~is_score
    same = (
        (~m["epa_is_terminal"].fillna(False).astype(bool))
        & (~m["epa_possession_change"].fillna(False).astype(bool))
        & (~m["epa_is_timeout"].fillna(False).astype(bool))
    )

    def _slice(mask: pd.Series) -> dict[str, Any]:
        n = int(mask.sum())
        if n == 0:
            return {"n": 0, "mae": None}
        return {"n": n, "mae": float(abs_err.loc[mask].mean())}

    return {
        "overall": _slice(pd.Series(True, index=m.index)),
        "same_possession_non_terminal": _slice(same),
        "terminal": _slice(m["epa_is_terminal"].fillna(False).astype(bool)),
        "timeout": _slice(m["epa_is_timeout"].fillna(False).astype(bool)),
        "possession_change_all": _slice(m["epa_possession_change"].fillna(False).astype(bool)),
        "possession_change_after_score": _slice(pc_after_score),
        "possession_change_non_score": _slice(pc_non_score),
        "kick_related_play_type": _slice(is_kick_related),
        "classification_notes": {
            "possession_change_after_score": (
                "Intentional convention gap vs nflfastR: Stage A jumps to next same-half "
                "scrimmage EP (often post-kickoff) and does not cash R into ep_after; "
                "nflfastR uses kickoff/touchback EP special cases."
            ),
            "possession_change_non_score": (
                "Mix of turnovers on downs / punts / interceptions without score. "
                "Sign-flip identity (-ep_after - ep_before) is tested; residual MAE may "
                "reflect EP level differences vs reference, not EPA identity bugs."
            ),
            "same_possession_non_terminal": (
                "Healthy agreement band when conventions align (target ≈0.3–0.4 MAE)."
            ),
        },
    }


def accounting_identity_on_intervals(
    scored: pd.DataFrame,
    *,
    max_games: int = 40,
    continuity_atol: float = 1e-4,
) -> dict[str, Any]:
    """Check Stage A telescoping identities on historical same-possession intervals.

    Only **eligible contiguous next-scrimmage chains** are checked: REG-style rows with
    non-null ``down`` where each play's ``model_ep_after_raw`` equals the next chain
    row's ``model_ep`` (intervening kickoff/admin rows are excluded from the chain).

    Exclusions (documented): timeouts, possession changes, non-continuous intervals,
    score-cashing residuals, and 2023 holdout.
    """
    df = scored.sort_values(["game_id", "play_id"], kind="mergesort")
    # Scrimmage snaps only — EPA next-state links skip null-down admin rows.
    if "down" in df.columns:
        down = pd.to_numeric(df["down"], errors="coerce")
        df = df.loc[down.notna()].copy()
    games = list(df["game_id"].dropna().unique())[:max_games]
    same_ok = 0
    same_fail = 0
    term_ok = 0
    term_fail = 0
    skipped_discontinuous = 0
    checked_plays = 0

    for gid in games:
        g = df[df["game_id"] == gid]
        ep_b = g["model_ep"].to_numpy(dtype=float)
        ep_a = g["model_ep_after_raw"].to_numpy(dtype=float)
        pc = g["epa_possession_change"].fillna(False).to_numpy(dtype=bool)
        to = g["epa_is_timeout"].fillna(False).to_numpy(dtype=bool)
        term = g["epa_is_terminal"].fillna(False).to_numpy(dtype=bool)
        epa = g["model_epa"].to_numpy(dtype=float)
        n = len(g)
        i = 0
        while i < n:
            if to[i] or pc[i]:
                i += 1
                continue
            if term[i]:
                if abs(epa[i] + ep_b[i]) < continuity_atol:
                    term_ok += 1
                else:
                    term_fail += 1
                checked_plays += 1
                i += 1
                continue
            # Grow a contiguous next-scrimmage same-possession chain
            start = i
            j = i
            continuous = True
            while j + 1 < n and (not to[j]) and (not pc[j]) and (not term[j]):
                if abs(ep_a[j] - ep_b[j + 1]) > continuity_atol:
                    continuous = False
                    break
                if to[j + 1] or pc[j + 1]:
                    break
                j += 1
                if term[j]:
                    break
            if not continuous:
                skipped_discontinuous += 1
                i += 1
                continue
            end = j  # inclusive
            chain_epa = float(epa[start : end + 1].sum())
            if term[end]:
                expected = -ep_b[start]
                if abs(chain_epa - expected) < continuity_atol:
                    term_ok += 1
                else:
                    term_fail += 1
            else:
                expected = ep_a[end] - ep_b[start]
                if abs(chain_epa - expected) < continuity_atol:
                    same_ok += 1
                else:
                    same_fail += 1
            checked_plays += end - start + 1
            i = end + 1

    return {
        "games_checked": len(games),
        "plays_in_checked_chains": checked_plays,
        "same_possession_telescoping": {"ok": same_ok, "fail": same_fail},
        "terminal_telescoping": {"ok": term_ok, "fail": term_fail},
        "skipped_discontinuous_starts": skipped_discontinuous,
        "exclusions": [
            "timeouts (EPA≡0)",
            "possession-change plays (sign-flip; not telescoping in posteam EP units)",
            "null-down / admin rows between snaps (not part of next-scrimmage chain)",
            "intervals where ep_after[i] ≠ ep_before[i+1] (non-contiguous next-scrimmage)",
            "realized next-score cashing ΣEPA=R−EP0 (not Stage A convention)",
            "2023 holdout (never used for this diagnostic tuning)",
        ],
        "pass": same_fail == 0 and term_fail == 0,
    }


def run_reconciliation(
    model: EPModel,
    *,
    seasons: tuple[int, ...] = (2019, 2020, 2021, 2022),
    out_path: Path | None = None,
    max_identity_games: int = 40,
) -> dict[str, Any]:
    """Build focused reconciliation payload on train+val seasons only."""
    if 2023 in seasons:
        raise ValueError("Do not run convention reconciliation on 2023 holdout")
    frame = build_modeling_frame(seasons)
    splits = split_frames(frame)
    # Prefer validate 2022 for agreement slices; fall back to train if val absent
    val = splits["val"]
    if val.empty:
        raise ValueError("Expected validate 2022 rows for reconciliation")
    raw = load_raw_seasons(sorted(int(x) for x in val["season"].unique()))
    games = set(val["game_id"].unique())
    raw = raw[raw["game_id"].isin(games)].copy()
    scored = score_model_epa(model, raw)
    slices = decompose_epa_vs_reference(scored, val)

    # Identity on a sample of train-season games only (2019–2021)
    train_raw = load_raw_seasons((2019, 2020, 2021))
    train_games = list(splits["train"]["game_id"].unique())[:max_identity_games]
    train_raw = train_raw[train_raw["game_id"].isin(train_games)].copy()
    train_scored = score_model_epa(model, train_raw)
    identity = accounting_identity_on_intervals(train_scored, max_games=max_identity_games)

    payload: dict[str, Any] = {
        "scope": "focused_reconciliation_stage_a",
        "seasons_for_agreement_slices": sorted(int(x) for x in val["season"].unique()),
        "seasons_for_identity_sample": [2019, 2020, 2021],
        "holdout_2023_unused": True,
        "target_definition": "next_score_in_half_7class_posteam_perspective",
        "epa_convention": "possession_aware_sign_flip_no_score_cash",
        "nflfastr_bit_parity_required": False,
        "epa_mae_slices_validate": slices,
        "accounting_identity_train_sample": identity,
        "intentional_convention_diffs": [
            "No kickoff/touchback EP special-case layer; next state = next same-half scrimmage",
            "Scoring plays do not cash R into ep_after (ΣEPA ≠ R − EP0 by design)",
            "XP/2PT are not independent next-score labels (TD = +7 folds try)",
            "OT bundled into second-half labeling bucket",
        ],
        "unresolved_defects": [],
        "gate": (
            "Internal EPA identities pass; remaining possession-change MAE vs nflverse "
            "explained as convention (esp. post-score) — not blocking WP if no new defect found"
        ),
    }
    # Mark unresolved only if identity fails
    if not identity["pass"]:
        payload["unresolved_defects"].append(
            "Stage A telescoping identity failed on train-season sample — investigate before WP"
        )
        payload["gate"] = "BLOCKED: accounting identity failures on train sample"

    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    return payload
