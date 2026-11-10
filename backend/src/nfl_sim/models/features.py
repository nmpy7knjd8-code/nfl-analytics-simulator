"""Leakage-safe EP feature matrix (fit on train only)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from nfl_sim.models.constants import (
    CATEGORICAL_FEATURES,
    FORBIDDEN_EXACT,
    FORBIDDEN_FEATURE_SUBSTRINGS,
    NUMERIC_FEATURES,
)


def era_post_2020_indicator(season: pd.Series) -> pd.Series:
    """Binary era encoding: season≥2021 → 1. Diagnostic / ablation only — not a production feature."""
    return (pd.to_numeric(season, errors="coerce") >= 2021).astype(float)


def build_feature_frame(pbp: pd.DataFrame) -> pd.DataFrame:
    """Construct model feature columns from raw/canonical-compatible PBP.

    Includes diagnostic ``era_post_2020`` for ablation tooling; ``FeatureBuilder``
    fits only ``NUMERIC_FEATURES`` + ``CATEGORICAL_FEATURES`` (era excluded).
    """
    down = pd.to_numeric(pbp["down"], errors="coerce")
    distance = pd.to_numeric(pbp["ydstogo"], errors="coerce")
    y100 = pd.to_numeric(pbp["yardline_100"], errors="coerce")
    half = pd.to_numeric(pbp["half_seconds_remaining"], errors="coerce")
    pot = pd.to_numeric(
        pbp["posteam_timeouts_remaining"] if "posteam_timeouts_remaining" in pbp.columns else pbp.get("posteam_timeouts"),
        errors="coerce",
    )
    dot = pd.to_numeric(
        pbp["defteam_timeouts_remaining"] if "defteam_timeouts_remaining" in pbp.columns else pbp.get("defteam_timeouts"),
        errors="coerce",
    )
    is_home = (pbp["posteam"].astype("string") == pbp["home_team"].astype("string")).astype(float)
    season = pd.to_numeric(pbp["season"], errors="coerce")
    era = era_post_2020_indicator(season)
    roof = pbp["roof"].astype("string") if "roof" in pbp.columns else pd.Series("unknown", index=pbp.index, dtype="string")
    roof = roof.fillna("unknown").str.lower()
    # Collapse rare / unexpected roofs
    allowed = {"dome", "outdoors", "closed", "open"}
    roof = roof.where(roof.isin(allowed), "other")

    frame = pd.DataFrame(
        {
            "down": down,
            "distance": distance,
            "yardline_100": y100,
            "half_seconds_remaining": half,
            "posteam_timeouts": pot,
            "defteam_timeouts": dot,
            "is_home_possession": is_home,
            "era_post_2020": era,
            "roof": roof,
        },
        index=pbp.index,
    )
    return frame


# The pregame point spread is known before kickoff, so it is not leakage; the WP model
# uses it (internal input only, never shown to fans). Raw spread_line / vegas_* stay banned.
PREGAME_ALLOWED_FEATURES: frozenset[str] = frozenset({"posteam_spread", "posteam_spread_decayed"})


def assert_no_leakage_columns(columns: list[str] | tuple[str, ...]) -> None:
    """Raise if any forbidden reference/odds column sneaks into features."""
    bad: list[str] = []
    for c in columns:
        cl = c.lower()
        if cl.split("__")[-1] in PREGAME_ALLOWED_FEATURES:
            continue  # known before kickoff, not a model output (WP model only)
        if cl in FORBIDDEN_EXACT:
            bad.append(c)
            continue
        # Allow era_post_2020 / is_home_possession; block bare ep/epa/wp tokens as whole feature names
        base = cl.split("__")[-1]
        if base in FORBIDDEN_EXACT:
            bad.append(c)
            continue
        for frag in ("reference_", "vegas_", "spread_"):
            if frag in cl:
                bad.append(c)
                break
        else:
            # exact token match for ep/epa/wp as feature leaf names
            leaf = base.split("_")[-1] if "_" in base else base
            if leaf in {"ep", "epa", "wp", "wpa"} and not base.startswith("era"):
                # yardline etc. OK; block *ep as standalone
                if base in {"ep", "epa", "wp", "wpa"} or base.endswith("_ep") or base.endswith("_epa"):
                    bad.append(c)
    if bad:
        raise ValueError(f"Leakage: forbidden feature columns: {sorted(set(bad))}")


@dataclass
class FeatureBuilder:
    """ColumnTransformer wrapper fit on train only."""

    transformer: ColumnTransformer | None = None

    def fit(self, X: pd.DataFrame) -> FeatureBuilder:
        assert_no_leakage_columns(list(X.columns))
        missing = [c for c in NUMERIC_FEATURES + CATEGORICAL_FEATURES if c not in X.columns]
        if missing:
            raise ValueError(f"Feature frame missing production columns: {missing}")
        if "era_post_2020" in NUMERIC_FEATURES:
            raise ValueError("era_post_2020 must not be in production NUMERIC_FEATURES")
        numeric = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scale", StandardScaler()),
            ]
        )
        categorical = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="most_frequent")),
                (
                    "onehot",
                    OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                ),
            ]
        )
        self.transformer = ColumnTransformer(
            transformers=[
                ("num", numeric, list(NUMERIC_FEATURES)),
                ("cat", categorical, list(CATEGORICAL_FEATURES)),
            ]
        )
        self.transformer.fit(X[list(NUMERIC_FEATURES) + list(CATEGORICAL_FEATURES)])
        # Validate transformed feature names
        names = list(self.transformer.get_feature_names_out())
        assert_no_leakage_columns(names)
        if any("era_post_2020" in n for n in names):
            raise ValueError("Production feature matrix must not include era_post_2020")
        return self

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        if self.transformer is None:
            raise RuntimeError("FeatureBuilder not fit")
        assert_no_leakage_columns(list(X.columns))
        return self.transformer.transform(X[list(NUMERIC_FEATURES) + list(CATEGORICAL_FEATURES)])

    def fit_transform(self, X: pd.DataFrame) -> np.ndarray:
        return self.fit(X).transform(X)

    @property
    def feature_names(self) -> list[str]:
        if self.transformer is None:
            return []
        return list(self.transformer.get_feature_names_out())
