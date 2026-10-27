"""Leakage-safe WP feature matrix — reuses EP leakage guards; Path A feature set."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from nfl_sim.ingest.derive import derive_receive_2h_ko
from nfl_sim.models.features import assert_no_leakage_columns

# Production WP v0 numerics (docs/WP_MODEL_SPEC.md). No roof / era / EP.
WP_NUMERIC_FEATURES: tuple[str, ...] = (
    "score_differential",
    "game_seconds_remaining",
    "half_seconds_remaining",
    "down",
    "distance",
    "yardline_100",
    "posteam_timeouts",
    "defteam_timeouts",
    "is_home_possession",
    "receive_2h_ko",
)

# H6: the primary WP model adds a score×time interaction (lead / sqrt(hours left)).
WP_MODEL_FEATURES: tuple[str, ...] = WP_NUMERIC_FEATURES + ("score_time_ratio",)

# Pregame strength (internal model input only; never exported to fans): the possession
# team's pregame point spread (nflverse spread_line, + = favored) and the same spread
# decayed with game time, exp(-SPREAD_DECAY * elapsed share), as nflfastR's spread model.
# What-if states with no matchup (the 4th-down grid) use 0 = evenly matched teams.
SPREAD_DECAY = 4.0
WP_PREGAME_FEATURES: tuple[str, ...] = ("posteam_spread", "posteam_spread_decayed")
WP_SPREAD_MODEL_FEATURES: tuple[str, ...] = WP_MODEL_FEATURES + WP_PREGAME_FEATURES

# Minimal score+time baseline subset
WP_SCORE_TIME_FEATURES: tuple[str, ...] = (
    "score_differential",
    "game_seconds_remaining",
)


def build_wp_feature_frame(pbp: pd.DataFrame) -> pd.DataFrame:
    """Construct WP feature columns from raw/canonical-compatible PBP."""
    down = pd.to_numeric(pbp["down"], errors="coerce")
    distance = pd.to_numeric(pbp["ydstogo"], errors="coerce")
    y100 = pd.to_numeric(pbp["yardline_100"], errors="coerce")
    half = pd.to_numeric(pbp["half_seconds_remaining"], errors="coerce")
    gsec = pd.to_numeric(pbp["game_seconds_remaining"], errors="coerce")
    sd = pd.to_numeric(pbp["score_differential"], errors="coerce")
    pot = pd.to_numeric(
        pbp["posteam_timeouts_remaining"]
        if "posteam_timeouts_remaining" in pbp.columns
        else pbp.get("posteam_timeouts"),
        errors="coerce",
    )
    dot = pd.to_numeric(
        pbp["defteam_timeouts_remaining"]
        if "defteam_timeouts_remaining" in pbp.columns
        else pbp.get("defteam_timeouts"),
        errors="coerce",
    )
    is_home = (pbp["posteam"].astype("string") == pbp["home_team"].astype("string")).astype(float)

    if "receive_2h_ko" in pbp.columns:
        r2h = pd.to_numeric(pbp["receive_2h_ko"], errors="coerce")
    else:
        r2h = pd.to_numeric(derive_receive_2h_ko(pbp), errors="coerce")
    # Spec: outside first half → encode as 0
    r2h = r2h.fillna(0.0)

    if "posteam_spread" in pbp.columns:
        spread = pd.to_numeric(pbp["posteam_spread"], errors="coerce")
    elif "spread_line" in pbp.columns:
        line = pd.to_numeric(pbp["spread_line"], errors="coerce")
        spread = pd.Series(np.where(is_home == 1.0, line, -line), index=pbp.index)
    else:
        spread = pd.Series(0.0, index=pbp.index)
    spread = spread.fillna(0.0).astype(float)
    elapsed = (3600.0 - gsec.clip(lower=0, upper=3600)) / 3600.0

    frame = pd.DataFrame(
        {
            "score_differential": sd,
            "game_seconds_remaining": gsec,
            "half_seconds_remaining": half,
            "down": down,
            "distance": distance,
            "yardline_100": y100,
            "posteam_timeouts": pot,
            "defteam_timeouts": dot,
            "is_home_possession": is_home,
            "receive_2h_ko": r2h.astype(float),
            # H6: a lead matters more as the clock runs down; a linear model needs
            # the interaction spelled out (used by WP_V2_FEATURES only).
            "score_time_ratio": sd / np.sqrt(gsec.clip(lower=0) / 3600.0 + 0.05),
            "posteam_spread": spread,
            "posteam_spread_decayed": spread * np.exp(-SPREAD_DECAY * elapsed),
        },
        index=pbp.index,
    )
    assert_no_leakage_columns(list(frame.columns))
    return frame


@dataclass
class WPFeatureBuilder:
    """Impute + scale; fit on train only. Numeric-only Path A set."""

    feature_names_: list[str] | None = None
    transformer: ColumnTransformer | None = None
    columns: tuple[str, ...] = WP_NUMERIC_FEATURES

    def fit(self, X: pd.DataFrame) -> WPFeatureBuilder:
        assert_no_leakage_columns(list(X.columns))
        missing = [c for c in self.columns if c not in X.columns]
        if missing:
            raise ValueError(f"WP feature frame missing columns: {missing}")
        numeric = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scale", StandardScaler()),
            ]
        )
        self.transformer = ColumnTransformer(
            transformers=[("num", numeric, list(self.columns))]
        )
        self.transformer.fit(X[list(self.columns)])
        self.feature_names_ = list(self.transformer.get_feature_names_out())
        assert_no_leakage_columns(self.feature_names_)
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        if self.transformer is None:
            raise RuntimeError("WPFeatureBuilder not fit")
        assert_no_leakage_columns(list(X.columns))
        return self.transformer.transform(X[list(self.columns)])

    def fit_transform(self, X: pd.DataFrame) -> np.ndarray:
        return self.fit(X).transform(X)

    @property
    def feature_names(self) -> list[str]:
        return list(self.feature_names_ or [])
