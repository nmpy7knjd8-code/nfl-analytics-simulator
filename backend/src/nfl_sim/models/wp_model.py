"""Sklearn binary WP model — train/eval (Path A: no EP feature)."""

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
from sklearn.metrics import brier_score_loss, log_loss

from nfl_sim.models.constants import RANDOM_SEED, TEST_SEASON, TRAIN_SEASONS, VAL_SEASON
from nfl_sim.models.dataset import data_hash_for_seasons, split_frames
from nfl_sim.models.features import assert_no_leakage_columns
from nfl_sim.models.split import forbid_test_season_in_fit
from nfl_sim.models.wp_features import (
    WP_MODEL_FEATURES,
    WP_NUMERIC_FEATURES,
    WP_SCORE_TIME_FEATURES,
    WP_SPREAD_MODEL_FEATURES,
    WPFeatureBuilder,
    build_wp_feature_frame,
)


# Spread WP model (internal pregame input): fit 2019–2023, holdout 2024–2025.
WP_FIT_SEASONS: tuple[int, ...] = (2019, 2020, 2021, 2022, 2023)
WP_TUNE_SEASON: int = 2023  # C picked by fitting 2019–22 and scoring 2023
WP_HOLDOUT_SEASONS: tuple[int, ...] = (2024, 2025)
WP_HOLDOUT_BRIER_MAX: float = 0.150
WP_SPREAD_MODEL_FILE: str = "wp_spread_model.joblib"  # used only when a real game's spread is known


@dataclass
class ConstantWinBaseline:
    """Train-frequency constant P(win)."""

    p_: float = 0.5

    def fit(self, y: pd.Series) -> ConstantWinBaseline:
        vals = pd.to_numeric(y, errors="coerce").dropna()
        self.p_ = float(vals.mean()) if len(vals) else 0.5
        return self

    def predict_proba(self, n: int) -> np.ndarray:
        """Return shape (n, 2) columns [P(lose), P(win)]."""
        p = self.p_
        return np.column_stack([np.full(n, 1.0 - p), np.full(n, p)])


@dataclass
class ScoreTimeBaseline:
    """Logistic on score_differential + game_seconds_remaining only."""

    feature_builder: WPFeatureBuilder = field(
        default_factory=lambda: WPFeatureBuilder(columns=WP_SCORE_TIME_FEATURES)
    )
    classifier: LogisticRegression | None = None

    def fit(self, train_df: pd.DataFrame, *, C: float = 1.0) -> ScoreTimeBaseline:
        forbid_test_season_in_fit(train_df["season"].unique(), context="train_fit")
        X = build_wp_feature_frame(train_df)
        Xt = self.feature_builder.fit_transform(X)
        y = train_df["wp_label"].astype(int)
        self.classifier = LogisticRegression(
            solver="lbfgs",
            max_iter=2000,
            C=C,
            random_state=RANDOM_SEED,
        )
        self.classifier.fit(Xt, y)
        return self

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        if self.classifier is None:
            raise RuntimeError("baseline not fit")
        X = build_wp_feature_frame(df)
        Xt = self.feature_builder.transform(X)
        return self.classifier.predict_proba(Xt)


@dataclass
class WPModel:
    feature_builder: WPFeatureBuilder = field(
        default_factory=lambda: WPFeatureBuilder(columns=WP_MODEL_FEATURES)
    )
    classifier: LogisticRegression | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    def fit(
        self, train_df: pd.DataFrame, *, C: float = 1.0, fit_seasons: tuple[int, ...] | None = None
    ) -> WPModel:
        seasons = set(int(x) for x in train_df["season"].unique())
        if fit_seasons is None:
            forbid_test_season_in_fit(seasons, context="train_fit")
            if int(TEST_SEASON) in seasons:
                raise ValueError("Refusing to train WP on test season 2023")
        else:
            # Spread model split: fit/tune only on fit_seasons; 2024–25 is the untouched holdout.
            bad = sorted(seasons - set(fit_seasons)) + sorted(seasons & set(WP_HOLDOUT_SEASONS))
            if bad:
                raise ValueError(f"WP fit outside allowed seasons {fit_seasons}: {sorted(set(bad))}")
        X = build_wp_feature_frame(train_df)
        assert_no_leakage_columns(list(X.columns))
        Xt = self.feature_builder.fit_transform(X)
        y = train_df["wp_label"].astype(int)
        self.classifier = LogisticRegression(
            solver="lbfgs",
            max_iter=2000,
            C=C,
            random_state=RANDOM_SEED,
        )
        self.classifier.fit(Xt, y)
        self.meta["C"] = C
        self.meta["train_seasons"] = sorted(int(x) for x in train_df["season"].unique())
        self.meta["train_n"] = int(len(train_df))
        self.meta["feature_names"] = self.feature_builder.feature_names
        self.meta["path"] = "A_no_ep_feature"
        return self

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        if self.classifier is None:
            raise RuntimeError("model not fit")
        X = build_wp_feature_frame(df)
        Xt = self.feature_builder.transform(X)
        return self.classifier.predict_proba(Xt)

    def predict_wp(self, df: pd.DataFrame) -> np.ndarray:
        """P(posteam wins)."""
        proba = self.predict_proba(df)
        # classes_ may be [0,1]
        classes = list(self.classifier.classes_)  # type: ignore[union-attr]
        win_i = classes.index(1) if 1 in classes else -1
        return proba[:, win_i]

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)

    @staticmethod
    def load(path: Path) -> WPModel:
        return joblib.load(path)


def _win_col(proba: np.ndarray, classes: list | np.ndarray) -> np.ndarray:
    classes_l = list(classes)
    if 1 in classes_l:
        return proba[:, classes_l.index(1)]
    return proba[:, -1]


def evaluate_wp_split(
    model: WPModel,
    constant: ConstantWinBaseline,
    score_time: ScoreTimeBaseline,
    df: pd.DataFrame,
    *,
    split_name: str,
) -> dict[str, Any]:
    y = df["wp_label"].astype(int).to_numpy()
    proba = model.predict_proba(df)
    p_win = model.predict_wp(df)
    ll = float(log_loss(y, proba, labels=[0, 1]))
    brier = float(brier_score_loss(y, p_win))

    c_proba = constant.predict_proba(len(df))
    c_ll = float(log_loss(y, c_proba, labels=[0, 1]))
    c_brier = float(brier_score_loss(y, c_proba[:, 1]))

    st_proba = score_time.predict_proba(df)
    st_p = _win_col(st_proba, score_time.classifier.classes_)  # type: ignore[union-attr]
    st_ll = float(log_loss(y, st_proba, labels=[0, 1]))
    st_brier = float(brier_score_loss(y, st_p))

    # Score / time slices
    slices: dict[str, Any] = {}
    sd = pd.to_numeric(df["score_differential"], errors="coerce")
    gsec = pd.to_numeric(df["game_seconds_remaining"], errors="coerce")
    for name, mask in (
        ("leading", sd > 0),
        ("tied", sd == 0),
        ("trailing", sd < 0),
        ("q4_or_ot_clock_lt_300", (gsec <= 300) & (pd.to_numeric(df["qtr"], errors="coerce") >= 4)),
        ("first_half", pd.to_numeric(df["qtr"], errors="coerce") <= 2),
    ):
        m = mask.fillna(False).to_numpy()
        n = int(m.sum())
        if n < 10:
            continue
        slices[name] = {
            "n": n,
            "log_loss": float(log_loss(y[m], proba[m], labels=[0, 1])),
            "brier": float(brier_score_loss(y[m], p_win[m])),
            "mean_wp": float(p_win[m].mean()),
            "empirical_win_rate": float(y[m].mean()),
        }

    # Optional lake wp agreement (descriptive only)
    agreement: dict[str, Any] = {}
    if "wp" in df.columns:
        ref = pd.to_numeric(df["wp"], errors="coerce")
        valid = ref.notna().to_numpy()
        if valid.any():
            agreement["mae_vs_lake_wp"] = float(np.mean(np.abs(p_win[valid] - ref.to_numpy()[valid])))
            agreement["n"] = int(valid.sum())
            agreement["note"] = "nflverse wp is reference agreement only — not a pass/fail gate"

    return {
        "split": split_name,
        "n": int(len(df)),
        "seasons": sorted(int(x) for x in df["season"].unique()),
        "win_rate": float(y.mean()),
        "model": {"log_loss": ll, "brier": brier, "mean_wp": float(p_win.mean())},
        "baseline_constant": {"log_loss": c_ll, "brier": c_brier, "p_win": constant.p_},
        "baseline_score_time": {"log_loss": st_ll, "brier": st_brier},
        "slices": slices,
        "reference_agreement_only": agreement,
    }


def select_C_on_val(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    candidates: tuple[float, ...] = (0.25, 1.0, 4.0),
) -> tuple[float, dict[str, float]]:
    forbid_test_season_in_fit(train_df["season"].unique(), context="train_fit")
    forbid_test_season_in_fit(val_df["season"].unique(), context="val_select")
    scores: dict[str, float] = {}
    best_C = candidates[0]
    best_ll = float("inf")
    for C in candidates:
        m = WPModel().fit(train_df, C=C)
        proba = m.predict_proba(val_df)
        ll = float(log_loss(val_df["wp_label"].astype(int), proba, labels=[0, 1]))
        scores[str(C)] = ll
        if ll < best_ll:
            best_ll = ll
            best_C = C
    return best_C, scores


def calibration_table(y: np.ndarray, p: np.ndarray, n_bins: int = 10) -> pd.DataFrame:
    try:
        bins = pd.qcut(p, n_bins, duplicates="drop")
    except ValueError:
        return pd.DataFrame(columns=["bin", "n", "mean_p", "mean_y"])
    return (
        pd.DataFrame({"p": p, "y": y, "bin": bins})
        .groupby("bin", observed=False)
        .agg(n=("y", "size"), mean_p=("p", "mean"), mean_y=("y", "mean"))
        .reset_index()
    )


def train_and_evaluate_wp(
    frame: pd.DataFrame,
    *,
    out_dir: Path,
    include_test: bool = True,
    command: str | None = None,
) -> dict[str, Any]:
    splits = split_frames(frame)
    train_df, val_df, test_df = splits["train"], splits["val"], splits["test"]

    best_C, c_scores = select_C_on_val(train_df, val_df)
    model = WPModel().fit(train_df, C=best_C)
    constant = ConstantWinBaseline().fit(train_df["wp_label"])
    score_time = ScoreTimeBaseline().fit(train_df, C=1.0)

    packages = {
        "scikit-learn": metadata.version("scikit-learn"),
        "numpy": metadata.version("numpy"),
        "pandas": metadata.version("pandas"),
        "joblib": metadata.version("joblib"),
    }
    metrics: dict[str, Any] = {
        "target": "posteam_wins_game_binary",
        "spec": "docs/WP_MODEL_SPEC.md",
        "path": "A_no_ep_feature",
        "ep_model_loaded": None,
        "ep_labeled_rebuild_verified_sha256": (
            "1d4c6736c959baaab7bca8733344e113ecd9989a0a457689f1d45d84c38cf82e"
        ),
        "ep_labeled_rebuild_note": (
            "SHA verified at store internal/ep-labeled-rebuild/; not loaded for Path A train/eval"
        ),
        "split_rule": {
            "train": list(TRAIN_SEASONS),
            "val": [VAL_SEASON],
            "test": [TEST_SEASON],
        },
        "features": list(WP_NUMERIC_FEATURES),
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
            "scrimmage": "down + WP pre-play fields + binary win label (ties dropped)",
        },
        "n": {
            "train": int(len(train_df)),
            "val": int(len(val_df)),
            "test": int(len(test_df)),
            "labeled_total": int(len(frame)),
        },
        "validate": evaluate_wp_split(model, constant, score_time, val_df, split_name="val"),
        "packages": packages,
        "data_hash": data_hash_for_seasons(list(TRAIN_SEASONS) + [VAL_SEASON, TEST_SEASON]),
        "seed": RANDOM_SEED,
        "command": command,
    }
    if include_test:
        metrics["test"] = evaluate_wp_split(model, constant, score_time, test_df, split_name="test")
        metrics["test"]["note"] = "Held-out / report-only 2023 — not used for model selection"

    out_dir = Path(out_dir)
    art = out_dir / "artifacts"
    art.mkdir(parents=True, exist_ok=True)
    model_path = art / "wp_model.joblib"
    model.meta.update(
        {
            "selected_C": best_C,
            "val_log_loss_by_C": c_scores,
            "features": list(WP_NUMERIC_FEATURES),
            "data_hash": metrics["data_hash"],
            "packages": packages,
            "seed": RANDOM_SEED,
            "path": "A_no_ep_feature",
            "ep_model_loaded": None,
        }
    )
    model.save(model_path)
    (art / "wp_model.meta.json").write_text(json.dumps(model.meta, indent=2, sort_keys=True) + "\n")
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n")

    p_val = model.predict_wp(val_df)
    y_val = val_df["wp_label"].astype(int).to_numpy()
    cal = calibration_table(y_val, p_val)
    cal.to_csv(out_dir / "calibration_val.csv", index=False)

    return metrics



def train_spread_wp(
    frame: pd.DataFrame,
    *,
    out_dir: Path,
    candidates: tuple[float, ...] = (0.25, 1.0, 4.0),
    command: str | None = None,
) -> dict[str, Any]:
    """Spread WP: tune C on 2023 (fit 2019–22), refit 2019–23, score the 2024–25 holdout once."""
    season = frame["season"].astype(int)
    fit_df = frame[season.isin(WP_FIT_SEASONS)]
    hold_df = frame[season.isin(WP_HOLDOUT_SEASONS)]
    tune_fit = fit_df[fit_df["season"].astype(int) != WP_TUNE_SEASON]
    tune_val = fit_df[fit_df["season"].astype(int) == WP_TUNE_SEASON]
    feats = lambda: WPFeatureBuilder(columns=WP_SPREAD_MODEL_FEATURES)  # noqa: E731
    c_scores: dict[str, float] = {}
    for C in candidates:
        m = WPModel(feature_builder=feats()).fit(tune_fit, C=C, fit_seasons=WP_FIT_SEASONS)
        c_scores[str(C)] = float(log_loss(tune_val["wp_label"].astype(int), m.predict_proba(tune_val), labels=[0, 1]))
    best_C = float(min(c_scores, key=c_scores.get))
    model = WPModel(feature_builder=feats()).fit(fit_df, C=best_C, fit_seasons=WP_FIT_SEASONS)
    base = WPModel().fit(fit_df, C=best_C, fit_seasons=WP_FIT_SEASONS)  # same split, no spread

    y = hold_df["wp_label"].astype(int).to_numpy()
    p, p0 = model.predict_wp(hold_df), base.predict_wp(hold_df)
    metrics: dict[str, Any] = {
        "model": "logistic WP + pregame spread (internal input)",
        "features": list(WP_SPREAD_MODEL_FEATURES),
        "fit_seasons": list(WP_FIT_SEASONS),
        "tune": {"fit": list(WP_FIT_SEASONS[:-1]), "val": WP_TUNE_SEASON, "log_loss_by_C": c_scores,
                 "selected_C": best_C},
        "holdout": {
            "seasons": list(WP_HOLDOUT_SEASONS),
            "n": int(len(hold_df)),
            "brier": float(brier_score_loss(y, p)),
            "log_loss": float(log_loss(y, np.column_stack([1 - p, p]), labels=[0, 1])),
            "brier_without_spread_same_split": float(brier_score_loss(y, p0)),
            "brier_max": WP_HOLDOUT_BRIER_MAX,
        },
        "n_fit": int(len(fit_df)),
        "seed": RANDOM_SEED,
        "command": command,
    }
    art = Path(out_dir) / "artifacts"
    art.mkdir(parents=True, exist_ok=True)
    model.meta.update({"selected_C": best_C, "val_log_loss_by_C": c_scores, "features": list(WP_SPREAD_MODEL_FEATURES),
                       "path": "A_no_ep_feature+pregame_spread", "seed": RANDOM_SEED, "ep_model_loaded": None,
                       "holdout_brier_2024_25": metrics["holdout"]["brier"]})
    # Separate artifact: the generic 4th-down engine / grid.json keep the no-spread wp_model.joblib.
    model.save(art / WP_SPREAD_MODEL_FILE)
    (art / "wp_spread_model.meta.json").write_text(json.dumps(model.meta, indent=2, sort_keys=True) + "\n")
    (Path(out_dir) / "spread_metrics.json").write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n")
    return metrics
