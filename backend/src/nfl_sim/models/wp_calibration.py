"""WP calibration evaluation — freeze base C; OOF primary on validate 2022.

Never uses 2023+ for fitting or selecting a calibrator.
"""

from __future__ import annotations

import json
from importlib import metadata
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss
from sklearn.model_selection import StratifiedKFold

from nfl_sim.models.constants import RANDOM_SEED, TRAIN_SEASONS, VAL_SEASON
from nfl_sim.models.dataset import build_wp_modeling_frame, data_hash_for_seasons, split_frames
from nfl_sim.models.split import forbid_test_season_in_fit
from nfl_sim.models.wp_model import WPModel, calibration_table

Method = Literal["platt", "isotonic"]


def _ece_from_table(cal: pd.DataFrame) -> float:
    if cal.empty or int(cal["n"].sum()) == 0:
        return float("nan")
    return float(np.average(np.abs(cal["mean_p"] - cal["mean_y"]), weights=cal["n"]))


def _clip_p(p: np.ndarray) -> np.ndarray:
    return np.clip(p, 1e-6, 1.0 - 1e-6)


def fit_predict_platt(p_fit: np.ndarray, y_fit: np.ndarray, p_pred: np.ndarray) -> np.ndarray:
    """Platt: logistic regression on uncalibrated P(win)."""
    lr = LogisticRegression(solver="lbfgs", max_iter=1000, random_state=RANDOM_SEED)
    lr.fit(_clip_p(p_fit).reshape(-1, 1), y_fit.astype(int))
    return lr.predict_proba(_clip_p(p_pred).reshape(-1, 1))[:, 1]


def fit_predict_isotonic(p_fit: np.ndarray, y_fit: np.ndarray, p_pred: np.ndarray) -> np.ndarray:
    iso = IsotonicRegression(out_of_bounds="clip")
    iso.fit(_clip_p(p_fit), y_fit.astype(float))
    return iso.predict(_clip_p(p_pred))


def oof_calibrate(
    p: np.ndarray,
    y: np.ndarray,
    *,
    method: Method,
    n_splits: int = 5,
) -> np.ndarray:
    """Cross-fit calibrator on the same split (primary metric surface)."""
    y = y.astype(int)
    oof = np.zeros(len(y), dtype=float)
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_SEED)
    for fit_idx, pred_idx in skf.split(p, y):
        if method == "platt":
            oof[pred_idx] = fit_predict_platt(p[fit_idx], y[fit_idx], p[pred_idx])
        elif method == "isotonic":
            oof[pred_idx] = fit_predict_isotonic(p[fit_idx], y[fit_idx], p[pred_idx])
        else:
            raise ValueError(f"Unknown method {method}")
    return oof


def in_sample_calibrate(p: np.ndarray, y: np.ndarray, *, method: Method) -> np.ndarray:
    """Fit calibrator on all rows and predict same rows (secondary / optimistic)."""
    if method == "platt":
        return fit_predict_platt(p, y, p)
    if method == "isotonic":
        return fit_predict_isotonic(p, y, p)
    raise ValueError(f"Unknown method {method}")


def _metrics_block(y: np.ndarray, p: np.ndarray, *, label: str) -> dict[str, Any]:
    proba = np.column_stack([1.0 - p, p])
    cal = calibration_table(y, p)
    return {
        "label": label,
        "n": int(len(y)),
        "log_loss": float(log_loss(y, proba, labels=[0, 1])),
        "brier": float(brier_score_loss(y, p)),
        "ece_decile": _ece_from_table(cal),
        "mean_p": float(p.mean()),
        "empirical_win_rate": float(y.mean()),
    }


def run_wp_calibration_eval(
    *,
    out_dir: Path,
    C: float = 0.25,
    n_splits: int = 5,
    include_isotonic: bool = True,
    command: str | None = None,
) -> dict[str, Any]:
    """Freeze WP@C on train; evaluate calibration on validate 2022 only."""
    # Train+val only — never load 2023 into this evaluation path
    frame = build_wp_modeling_frame(list(TRAIN_SEASONS) + [VAL_SEASON])
    splits = split_frames(frame)
    train_df, val_df = splits["train"], splits["val"]
    forbid_test_season_in_fit(train_df["season"].unique(), context="train_fit")
    forbid_test_season_in_fit(val_df["season"].unique(), context="val_select")
    if int(2023) in set(int(x) for x in frame["season"].unique()):
        raise ValueError("Calibration eval must not include 2023")

    model = WPModel().fit(train_df, C=C)
    y = val_df["wp_label"].astype(int).to_numpy()
    p_raw = model.predict_wp(val_df)

    uncal = _metrics_block(y, p_raw, label="uncalibrated")
    platt_oof_p = oof_calibrate(p_raw, y, method="platt", n_splits=n_splits)
    platt_oof = _metrics_block(y, platt_oof_p, label="platt_oof")
    platt_is_p = in_sample_calibrate(p_raw, y, method="platt")
    platt_is = _metrics_block(y, platt_is_p, label="platt_in_sample_secondary")

    methods: dict[str, Any] = {
        "uncalibrated": uncal,
        "platt_oof_primary": platt_oof,
        "platt_in_sample_secondary": platt_is,
    }
    cal_tables = {
        "uncalibrated": calibration_table(y, p_raw).assign(source="uncalibrated"),
        "platt_oof": calibration_table(y, platt_oof_p).assign(source="platt_oof"),
    }

    isotonic_block: dict[str, Any] | None = None
    if include_isotonic:
        # Ablation only — reported if OOF ECE/LL clearly improves vs Platt
        iso_oof_p = oof_calibrate(p_raw, y, method="isotonic", n_splits=n_splits)
        iso_oof = _metrics_block(y, iso_oof_p, label="isotonic_oof_ablation")
        methods["isotonic_oof_ablation"] = iso_oof
        cal_tables["isotonic_oof"] = calibration_table(y, iso_oof_p).assign(source="isotonic_oof")
        isotonic_block = {
            "note": (
                "Ablation on validate 2022 OOF only. Prefer Platt unless isotonic "
                "shows a clear, stable ECE/LL gain without harming log-loss."
            ),
            "metrics": iso_oof,
        }

    # Prefer isotonic only if clearly better than Platt OOF on ECE with non-worse LL
    isotonic_justified = False
    iso_metrics = methods.get("isotonic_oof_ablation")
    if iso_metrics is not None:
        isotonic_justified = (
            (iso_metrics["ece_decile"] + 1e-9) < (platt_oof["ece_decile"] - 0.005)
            and iso_metrics["log_loss"] <= platt_oof["log_loss"] + 0.002
        )

    # Recommendation vs uncalibrated (documented; not a hard gate).
    # Primary comparison is Platt OOF; if isotonic is justified, score that candidate too.
    candidate = iso_metrics if isotonic_justified and iso_metrics is not None else platt_oof
    candidate_name = "isotonic_oof" if candidate is iso_metrics else "platt_oof"
    delta_ll = uncal["log_loss"] - candidate["log_loss"]
    delta_ece = uncal["ece_decile"] - candidate["ece_decile"]
    delta_brier = uncal["brier"] - candidate["brier"]
    # "Improved" only if OOF ECE drops materially AND LL/Brier do not worsen meaningfully
    improved = (
        delta_ece >= 0.01
        and delta_ll >= -0.002
        and delta_brier >= -0.002
        and (delta_ll >= 0.005 or delta_ece >= 0.02 or delta_brier >= 0.003)
    )
    # Adequate if uncalibrated ECE already modest and calibrator doesn't clearly help
    adequate = (not improved) and uncal["ece_decile"] < 0.06 and abs(delta_ece) < 0.015
    if improved:
        recommendation = "improved"
        rationale = (
            f"OOF {candidate_name} improves calibration/discrimination vs uncalibrated "
            f"(ΔLL={delta_ll:+.4f}, ΔBrier={delta_brier:+.4f}, ΔECE={delta_ece:+.4f}); "
            "keep calibrated scores as a separate candidate — do not replace the original eval."
        )
    elif adequate:
        recommendation = "adequate"
        rationale = (
            "Uncalibrated WP already has modest decile ECE; OOF calibration gains are too "
            "small to justify promoting a calibrated candidate on validate 2022 alone."
        )
    else:
        recommendation = "inconclusive"
        rationale = (
            "Calibration signal is mixed or effect sizes are small relative to sampling/"
            "cross-fit noise; do not change the production candidate from this run alone."
        )

    packages = {
        "scikit-learn": metadata.version("scikit-learn"),
        "numpy": metadata.version("numpy"),
        "pandas": metadata.version("pandas"),
        "joblib": metadata.version("joblib"),
    }
    payload: dict[str, Any] = {
        "command": command,
        "spec": "docs/WP_MODEL_SPEC.md",
        "base_model": {
            "C_frozen": C,
            "path": "A_no_ep_feature",
            "train_seasons": list(TRAIN_SEASONS),
            "train_n": int(len(train_df)),
            "val_season": VAL_SEASON,
            "val_n": int(len(val_df)),
            "note": "Base WP refit with frozen C=0.25 on train only; calibrator never sees 2023",
        },
        "protocol": {
            "primary": f"{n_splits}-fold stratified OOF on validate 2022",
            "secondary": "in-sample Platt on full validate 2022 (optimistic)",
            "isotonic": "ablation OOF; use only if justified vs Platt",
            "forbidden": "no 2023–2025 for fit/tune/selection",
        },
        "metrics": methods,
        "deltas_oof_platt_minus_uncal": {
            "log_loss": float(platt_oof["log_loss"] - uncal["log_loss"]),
            "brier": float(platt_oof["brier"] - uncal["brier"]),
            "ece_decile": float(platt_oof["ece_decile"] - uncal["ece_decile"]),
        },
        "recommendation": recommendation,
        "rationale": rationale,
        "isotonic_justified_vs_platt": isotonic_justified,
        "preferred_calibrator_candidate": candidate_name if improved else None,
        "isotonic": isotonic_block,
        "packages": packages,
        "data_hash": data_hash_for_seasons(list(TRAIN_SEASONS) + [VAL_SEASON]),
        "seed": RANDOM_SEED,
        "n_splits": n_splits,
        "original_eval_preserved": True,
    }

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "calibration_eval.json").write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    cal_all = pd.concat(cal_tables.values(), ignore_index=True)
    cal_all.to_csv(out_dir / "calibration_compare.csv", index=False)
    return payload
