"""Stage A EP class definitions — must match docs/EP_MODEL_SPEC.md."""

from __future__ import annotations

# Ordered class labels used by sklearn and reports
EP_CLASSES: tuple[str, ...] = (
    "Touchdown",
    "FieldGoal",
    "Safety",
    "NoScore",
    "OppSafety",
    "OppFieldGoal",
    "OppTouchdown",
)

EP_CLASS_VALUES: dict[str, float] = {
    "Touchdown": 7.0,
    "FieldGoal": 3.0,
    "Safety": 2.0,
    "NoScore": 0.0,
    "OppSafety": -2.0,
    "OppFieldGoal": -3.0,
    "OppTouchdown": -7.0,
}

CLASS_TO_INDEX: dict[str, int] = {c: i for i, c in enumerate(EP_CLASSES)}

# Columns that must never appear as model features
FORBIDDEN_FEATURE_SUBSTRINGS: tuple[str, ...] = (
    "ep",
    "epa",
    "wp",
    "wpa",
    "vegas",
    "spread",
    "td_prob",
    "fg_prob",
    "safety_prob",
    "no_score_prob",
    "opp_",
    "cp",
    "cpoe",
    "xpass",
    "xyac",
    "success",
    "reference_",
)

FORBIDDEN_EXACT: frozenset[str] = frozenset(
    {
        "ep",
        "epa",
        "wp",
        "wpa",
        "vegas_wp",
        "vegas_wpa",
        "home_wp",
        "away_wp",
        "home_wp_post",
        "away_wp_post",
        "spread_line",
        "total_line",
        "cp",
        "cpoe",
        "xpass",
        "success",
        "td_prob",
        "fg_prob",
        "safety_prob",
        "no_score_prob",
        "opp_td_prob",
        "opp_fg_prob",
        "opp_safety_prob",
    }
)

# Production Stage A features — era_post_2020 excluded (val ablation ΔLL≈0.001; see reports/ep).
NUMERIC_FEATURES: tuple[str, ...] = (
    "down",
    "distance",
    "yardline_100",
    "half_seconds_remaining",
    "posteam_timeouts",
    "defteam_timeouts",
    "is_home_possession",
)

# Diagnostic-only column built by build_feature_frame; not fit in the production model.
ABLATION_NUMERIC_FEATURES: tuple[str, ...] = ("era_post_2020",)

CATEGORICAL_FEATURES: tuple[str, ...] = ("roof",)

TRAIN_SEASONS: tuple[int, ...] = (2019, 2020, 2021)
VAL_SEASON: int = 2022
TEST_SEASON: int = 2023

RANDOM_SEED: int = 42
