"""Leakage-safe EP feature matrix (fit on train only)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from nfl_sim.models.constants import (
    CATEGORICAL_FEATURES,
    FORBIDDEN_EXACT,
    FORBIDDEN_FEATURE_SUBSTRINGS,
    NUMERIC_FEATURES,
)


def build_feature_frame(pbp: pd.DataFrame) -> pd.DataFrame:
    """Construct model feature columns from raw/canonical-compatible PBP."""
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
    era = (season >= 2021).astype(float)
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


def assert_no_leakage_columns(columns: list[str] | tuple[str, ...]) -> None:
    """Raise if any forbidden reference/odds column sneaks into features."""
    bad: list[str] = []
    for c in columns:
        cl = c.lower()
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
        numeric = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
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
