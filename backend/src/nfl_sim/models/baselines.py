"""2022-only empirical EP baselines (fit on train; never on val/test)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from nfl_sim.models.constants import EP_CLASSES, RANDOM_SEED
from nfl_sim.models.ep_model import ConstantBaseline, _log_loss_fixed_order, multiclass_brier
from nfl_sim.models.split import forbid_test_season_in_fit


def _class_index(y: pd.Series) -> np.ndarray:
    idx = {c: i for i, c in enumerate(EP_CLASSES)}
    return np.array([idx[str(v)] for v in y], dtype=int)


@dataclass
class YardlineBinBaseline:
    """Empirical class frequencies by yardline_100 decile bins (train only)."""

    bin_edges_: np.ndarray | None = None
    proba_by_bin_: np.ndarray | None = None  # (n_bins, 7)
    global_proba_: np.ndarray | None = None

    def fit(self, train_df: pd.DataFrame) -> YardlineBinBaseline:
        forbid_test_season_in_fit(train_df["season"].unique(), context="yardline_bin_fit")
        y100 = pd.to_numeric(train_df["yardline_100"], errors="coerce").to_numpy()
        y = train_df["ep_label"].astype(str)
        # Fixed edges 0–100 by 10
        self.bin_edges_ = np.arange(0, 101, 10, dtype=float)
        n_bins = len(self.bin_edges_) - 1
        self.proba_by_bin_ = np.zeros((n_bins, len(EP_CLASSES)), dtype=float)
        counts = y.value_counts()
        self.global_proba_ = np.array([counts.get(c, 0) for c in EP_CLASSES], dtype=float)
        self.global_proba_ = self.global_proba_ / max(self.global_proba_.sum(), 1.0)
        bins = np.clip(np.digitize(y100, self.bin_edges_[1:-1], right=False), 0, n_bins - 1)
        for b in range(n_bins):
            m = bins == b
            if not m.any():
                self.proba_by_bin_[b] = self.global_proba_
                continue
            vc = y[m].value_counts()
            freqs = np.array([vc.get(c, 0) for c in EP_CLASSES], dtype=float)
            # Laplace smooth within bin
            freqs = freqs + 1.0
            self.proba_by_bin_[b] = freqs / freqs.sum()
        return self

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        if self.bin_edges_ is None or self.proba_by_bin_ is None or self.global_proba_ is None:
            raise RuntimeError("not fit")
        y100 = pd.to_numeric(df["yardline_100"], errors="coerce").to_numpy()
        n_bins = len(self.bin_edges_) - 1
        bins = np.clip(np.digitize(y100, self.bin_edges_[1:-1], right=False), 0, n_bins - 1)
        out = self.proba_by_bin_[bins]
        # NaN yardline → global
        nan = np.isnan(y100)
        if nan.any():
            out = out.copy()
            out[nan] = self.global_proba_
        return out


@dataclass
class DownDistanceYardBaseline:
    """Smoothed empirical frequencies by down × distance-bucket × yardline-bin (train only)."""

    proba_: dict[tuple[int, int, int], np.ndarray] | None = None
    global_proba_: np.ndarray | None = None
    alpha: float = 5.0

    def _dist_bucket(self, dist: np.ndarray) -> np.ndarray:
        # 1, 2-3, 4-6, 7-10, 11+
        out = np.zeros(len(dist), dtype=int)
        out[dist >= 2] = 1
        out[dist >= 4] = 2
        out[dist >= 7] = 3
        out[dist >= 11] = 4
        return out

    def _y_bin(self, y100: np.ndarray) -> np.ndarray:
        return np.clip((y100 // 10).astype(int), 0, 9)

    def fit(self, train_df: pd.DataFrame) -> DownDistanceYardBaseline:
        forbid_test_season_in_fit(train_df["season"].unique(), context="ddy_fit")
        down = pd.to_numeric(train_df["down"], errors="coerce").fillna(1).astype(int).clip(1, 4)
        dist = pd.to_numeric(train_df["ydstogo"], errors="coerce").fillna(10).to_numpy()
        y100 = pd.to_numeric(train_df["yardline_100"], errors="coerce").fillna(50).to_numpy()
        y = train_df["ep_label"].astype(str)
        counts = y.value_counts()
        self.global_proba_ = np.array([counts.get(c, 0) for c in EP_CLASSES], dtype=float)
        self.global_proba_ = self.global_proba_ / max(self.global_proba_.sum(), 1.0)
        db = self._dist_bucket(dist)
        yb = self._y_bin(y100)
        self.proba_ = {}
        keys = list(zip(down.to_numpy(), db, yb))
        df_keys = pd.DataFrame({"key": keys, "label": y.to_numpy()})
        for key, grp in df_keys.groupby("key", sort=False):
            vc = grp["label"].value_counts()
            freqs = np.array([vc.get(c, 0) for c in EP_CLASSES], dtype=float)
            # Dirichlet/Laplace toward global prior
            freqs = freqs + self.alpha * self.global_proba_
            self.proba_[key] = freqs / freqs.sum()
        return self

    def predict_proba(self, df: pd.DataFrame) -> np.ndarray:
        if self.proba_ is None or self.global_proba_ is None:
            raise RuntimeError("not fit")
        down = pd.to_numeric(df["down"], errors="coerce").fillna(1).astype(int).clip(1, 4).to_numpy()
        dist = pd.to_numeric(df["ydstogo"], errors="coerce").fillna(10).to_numpy()
        y100 = pd.to_numeric(df["yardline_100"], errors="coerce").fillna(50).to_numpy()
        db = self._dist_bucket(dist)
        yb = self._y_bin(y100)
        out = np.zeros((len(df), len(EP_CLASSES)), dtype=float)
        for i in range(len(df)):
            key = (int(down[i]), int(db[i]), int(yb[i]))
            out[i] = self.proba_.get(key, self.global_proba_)
        return out


def evaluate_baselines_on_val(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
) -> dict:
    """Fit baselines on train; score validate 2022 only. Never touches 2023."""
    forbid_test_season_in_fit(train_df["season"].unique(), context="baseline_train")
    forbid_test_season_in_fit(val_df["season"].unique(), context="baseline_val")
    if set(int(x) for x in val_df["season"].unique()) != {2022}:
        raise ValueError("Baseline comparison must use validate season 2022 only")

    y = val_df["ep_label"].astype(str)
    y_idx = _class_index(y)
    const = ConstantBaseline().fit(train_df["ep_label"])
    yb = YardlineBinBaseline().fit(train_df)
    ddy = DownDistanceYardBaseline(alpha=5.0).fit(train_df)

    results = {}
    for name, proba in (
        ("constant_class_prior", const.predict_proba(len(val_df))),
        ("yardline_bin_empirical", yb.predict_proba(val_df)),
        ("down_distance_yardline_smoothed", ddy.predict_proba(val_df)),
    ):
        results[name] = {
            "n": int(len(val_df)),
            "log_loss": _log_loss_fixed_order(y, proba),
            "brier_multiclass": multiclass_brier(y_idx, proba, len(EP_CLASSES)),
            "fit_on": "train_2019_2021",
            "eval_on": "validate_2022",
            "seed": RANDOM_SEED,
        }
    return results
