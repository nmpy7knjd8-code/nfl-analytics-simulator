"""Sklearn multinomial EP model — train/eval/score."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from importlib import metadata
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss

from nfl_sim.models.constants import (
    EP_CLASS_VALUES,
    EP_CLASSES,
    RANDOM_SEED,
    TEST_SEASON,
    TRAIN_SEASONS,
    VAL_SEASON,
)
from nfl_sim.models.dataset import data_hash_for_seasons, split_frames
from nfl_sim.models.features import FeatureBuilder, assert_no_leakage_columns, build_feature_frame
from nfl_sim.models.split import forbid_test_season_in_fit


def expected_points_from_proba(proba: np.ndarray, class_order: list[str] | tuple[str, ...]) -> np.ndarray:
    values = np.array([EP_CLASS_VALUES[c] for c in class_order], dtype=float)
    return proba @ values


def multiclass_brier(y_true_idx: np.ndarray, proba: np.ndarray, n_classes: int) -> float:
    onehot = np.zeros_like(proba)
    onehot[np.arange(len(y_true_idx)), y_true_idx] = 1.0
    return float(np.mean(np.sum((proba - onehot) ** 2, axis=1)))


def _log_loss_fixed_order(y: pd.Series | list[str], proba: np.ndarray) -> float:
    """log_loss with proba columns in EP_CLASSES order (sklearn wants lex labels)."""
    lex = sorted(EP_CLASSES)
    class_to_i = {c: i for i, c in enumerate(EP_CLASSES)}
    lex_index = [class_to_i[c] for c in lex]
    proba_lex = proba[:, lex_index]
    return float(log_loss(y, proba_lex, labels=lex))


@dataclass
class ConstantBaseline:
    """Train-frequency constant probability predictor."""

    classes_: list[str] = field(default_factory=list)
    proba_: np.ndarray | None = None

    def fit(self, y: pd.Series) -> ConstantBaseline:
        counts = y.value_counts()
        self.classes_ = list(EP_CLASSES)
        freqs = np.array([counts.get(c, 0) for c in self.classes_], dtype=float)
        if freqs.sum() <= 0:
            freqs = np.ones(len(self.classes_))
        self.proba_ = freqs / freqs.sum()
        return self

    def predict_proba(self, n: int) -> np.ndarray:
        if self.proba_ is None:
            raise RuntimeError("baseline not fit")
        return np.tile(self.proba_, (n, 1))


@dataclass
class EPModel:
    feature_builder: FeatureBuilder = field(default_factory=FeatureBuilder)
    classifier: LogisticRegression | None = None
    classes_: list[str] = field(default_factory=lambda: list(EP_CLASSES))
    meta: dict[str, Any] = field(default_factory=dict)

    def fit(self, train_df: pd.DataFrame, *, C: float = 1.0) -> EPModel:
        forbid_test_season_in_fit(train_df["season"].unique(), context="train_fit")
        if int(TEST_SEASON) in set(int(x) for x in train_df["season"].unique()):
            raise ValueError("Refusing to train on test season 2023")
        X = build_feature_frame(train_df)
        assert_no_leakage_columns(list(X.columns))
        Xt = self.feature_builder.fit_transform(X)
        y = train_df["ep_label"].astype(str)
        # Map to EP_CLASSES order
        # sklearn≥1.8: multinomial is the multiclass default (no multi_class kw)
        self.classifier = LogisticRegression(
            solver="lbfgs",
            max_iter=2000,
            C=C,
            random_state=RANDOM_SEED,
        )
        self.classifier.fit(Xt, y)
        # sklearn may drop unseen classes — keep fixed order via predict_proba columns
        self.classes_ = list(self.classifier.classes_)
        self.meta["C"] = C
        self.meta["train_seasons"] = sorted(int(x) for x in train_df["season"].unique())
        self.meta["train_n"] = int(len(train_df))
        self.meta["feature_names"] = self.feature_builder.feature_names
        return self

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        if self.classifier is None:
            raise RuntimeError("model not fit")
        X = build_feature_frame(df)
        Xt = self.feature_builder.transform(X)
        proba = self.classifier.predict_proba(Xt)
        # Reorder to EP_CLASSES
        col_index = {c: i for i, c in enumerate(self.classifier.classes_)}
        out = np.zeros((len(df), len(EP_CLASSES)), dtype=float)
        for j, cls in enumerate(EP_CLASSES):
            if cls in col_index:
                out[:, j] = proba[:, col_index[cls]]
        # Renormalize if some classes missing
        row_sum = out.sum(axis=1, keepdims=True)
        row_sum[row_sum == 0] = 1.0
        return out / row_sum

    def predict_ep(self, df: pd.DataFrame) -> np.ndarray:
        return expected_points_from_proba(self.predict_proba(df), EP_CLASSES)

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)

    @staticmethod
    def load(path: Path) -> EPModel:
        return joblib.load(path)


def evaluate_split(
    model: EPModel,
    baseline: ConstantBaseline,
    df: pd.DataFrame,
    *,
    split_name: str,
) -> dict[str, Any]:
    y = df["ep_label"].astype(str)
    proba = model.predict_proba(df)
    class_to_i = {c: i for i, c in enumerate(EP_CLASSES)}
    y_idx = np.array([class_to_i[c] for c in y], dtype=int)
    # log_loss wants labels
    ll = _log_loss_fixed_order(y, proba)
    brier = multiclass_brier(y_idx, proba, len(EP_CLASSES))
    ep_hat = expected_points_from_proba(proba, EP_CLASSES)
    base_p = baseline.predict_proba(len(df))
    base_ll = _log_loss_fixed_order(y, base_p)
    base_brier = multiclass_brier(y_idx, base_p, len(EP_CLASSES))

    # Per-class support
    support = {c: int((y == c).sum()) for c in EP_CLASSES}

    # Situation slices
    slices: dict[str, Any] = {}
    down = pd.to_numeric(df["down"], errors="coerce")
    for d in (1, 2, 3, 4):
        m = down == d
        n = int(m.sum())
        if n == 0:
            continue
        slices[f"down_{d}"] = {
            "n": n,
            "log_loss": _log_loss_fixed_order(y[m], proba[m.to_numpy()]),
            "mae_ep_vs_reference": (
                float(np.mean(np.abs(ep_hat[m.to_numpy()] - pd.to_numeric(df.loc[m, "ep"], errors="coerce"))))
                if "ep" in df.columns
                else None
            ),
        }

    ref_ep = pd.to_numeric(df["ep"], errors="coerce") if "ep" in df.columns else None
    out: dict[str, Any] = {
        "split": split_name,
        "n": int(len(df)),
        "seasons": sorted(int(x) for x in df["season"].unique()),
        "model": {
            "log_loss": ll,
            "brier_multiclass": brier,
            "mean_ep": float(np.mean(ep_hat)),
        },
        "baseline_constant": {
            "log_loss": base_ll,
            "brier_multiclass": base_brier,
        },
        "class_support": support,
        "by_down": slices,
        "reference_agreement_only": {},
    }
    if ref_ep is not None:
        valid = ref_ep.notna().to_numpy()
        out["reference_agreement_only"]["mae_vs_reference_ep"] = float(
            np.mean(np.abs(ep_hat[valid] - ref_ep.to_numpy()[valid]))
        )
        out["reference_agreement_only"]["note"] = (
            "nflverse ep is reference agreement only — not ground truth"
        )
    # Brier for touchdown class (binary-style)
    td_idx = list(EP_CLASSES).index("Touchdown")
    y_td = (y_idx == td_idx).astype(float)
    out["model"]["brier_touchdown"] = float(np.mean((proba[:, td_idx] - y_td) ** 2))
    return out


def select_C_on_val(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    candidates: tuple[float, ...] = (0.25, 1.0, 4.0),
) -> tuple[float, dict[str, float]]:
    """Hyperparameter selection on validate 2022 only — never test."""
    forbid_test_season_in_fit(train_df["season"].unique(), context="train_fit")
    forbid_test_season_in_fit(val_df["season"].unique(), context="val_select")
    scores: dict[str, float] = {}
    best_C = candidates[0]
    best_ll = float("inf")
    for C in candidates:
        m = EPModel().fit(train_df, C=C)
        proba = m.predict_proba(val_df)
        ll = _log_loss_fixed_order(val_df["ep_label"].astype(str), proba)
        scores[str(C)] = ll
        if ll < best_ll:
            best_ll = ll
            best_C = C
    return best_C, scores


def train_and_evaluate(
    frame: pd.DataFrame,
    *,
    out_dir: Path,
    include_test: bool = True,
) -> dict[str, Any]:
    splits = split_frames(frame)
    train_df, val_df, test_df = splits["train"], splits["val"], splits["test"]

    best_C, c_scores = select_C_on_val(train_df, val_df)
    model = EPModel().fit(train_df, C=best_C)
    baseline = ConstantBaseline().fit(train_df["ep_label"])

    metrics: dict[str, Any] = {
        "target": "next_score_in_half_7class",
        "spec": "docs/EP_MODEL_SPEC.md",
        "split_rule": {
            "train": list(TRAIN_SEASONS),
            "val": [VAL_SEASON],
            "test": [TEST_SEASON],
        },
        "hyperparam_selection": {
            "param": "C",
            "candidates": list(c_scores.keys()),
            "val_log_loss_by_C": c_scores,
            "selected_C": best_C,
            "tuned_on": "validate_2022_only",
            "test_untouched_during_selection": True,
        },
        "filters": {
            "season_type": "REG",
            "scrimmage": "down not null + required pre-play fields + valid label",
        },
        "n": {
            "train": int(len(train_df)),
            "val": int(len(val_df)),
            "test": int(len(test_df)),
            "labeled_total": int(len(frame)),
        },
        "validate": evaluate_split(model, baseline, val_df, split_name="val"),
        "packages": {
            "scikit-learn": metadata.version("scikit-learn"),
            "numpy": metadata.version("numpy"),
            "pandas": metadata.version("pandas"),
            "joblib": metadata.version("joblib"),
        },
        "data_hash": data_hash_for_seasons(list(TRAIN_SEASONS) + [VAL_SEASON, TEST_SEASON]),
        "seed": RANDOM_SEED,
    }
    if include_test:
        # Evaluate once; no further tuning
        metrics["test"] = evaluate_split(model, baseline, test_df, split_name="test")
        metrics["test"]["note"] = "Held-out 2023 — not used for model selection"

    out_dir = Path(out_dir)
    art = out_dir / "artifacts"
    art.mkdir(parents=True, exist_ok=True)
    model_path = art / "ep_model.joblib"
    model.meta.update(
        {
            "selected_C": best_C,
            "val_log_loss_by_C": c_scores,
            "classes": list(EP_CLASSES),
            "class_values": EP_CLASS_VALUES,
            "data_hash": metrics["data_hash"],
            "packages": metrics["packages"],
            "seed": RANDOM_SEED,
        }
    )
    model.save(model_path)
    (art / "ep_model.meta.json").write_text(json.dumps(model.meta, indent=2, sort_keys=True) + "\n")
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n")

    # Simple calibration-by-decile for touchdown class on validate
    proba_val = model.predict_proba(val_df)
    td_i = list(EP_CLASSES).index("Touchdown")
    y_td = (val_df["ep_label"].astype(str) == "Touchdown").astype(float).to_numpy()
    p_td = proba_val[:, td_i]
    try:
        deciles = pd.qcut(p_td, 10, duplicates="drop")
        cal = (
            pd.DataFrame({"p": p_td, "y": y_td, "bin": deciles})
            .groupby("bin", observed=False)
            .agg(n=("y", "size"), mean_p=("p", "mean"), mean_y=("y", "mean"))
            .reset_index()
        )
        cal.to_csv(out_dir / "calibration_touchdown.csv", index=False)
    except ValueError:
        pass

    return metrics
