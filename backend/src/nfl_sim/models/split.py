"""Chronological experiment split — train/val/test enforcement.

Hard rule: never fit or tune on 2023–2025 (test/holdout). Validate hyperparameters on 2022 only.
"""

from __future__ import annotations

from typing import Iterable, Literal

import pandas as pd

SplitName = Literal["train", "val", "test"]

TRAIN_SEASONS: frozenset[int] = frozenset({2019, 2020, 2021})
VAL_SEASONS: frozenset[int] = frozenset({2022})
TEST_SEASONS: frozenset[int] = frozenset({2023, 2024, 2025})

ALL_MODEL_SEASONS: tuple[int, ...] = (2019, 2020, 2021, 2022, 2023, 2024, 2025)


def season_to_split(season: int) -> SplitName | None:
    if season in TRAIN_SEASONS:
        return "train"
    if season in VAL_SEASONS:
        return "val"
    if season in TEST_SEASONS:
        return "test"
    return None


def assign_split(seasons: pd.Series) -> pd.Series:
    s = pd.to_numeric(seasons, errors="coerce")
    out = pd.Series(pd.NA, index=seasons.index, dtype="string")
    out.loc[s.isin(TRAIN_SEASONS)] = "train"
    out.loc[s.isin(VAL_SEASONS)] = "val"
    out.loc[s.isin(TEST_SEASONS)] = "test"
    return out


def assert_split_integrity(
    seasons: Iterable[int],
    *,
    purpose: SplitName,
    allow_empty: bool = False,
) -> None:
    """Raise if seasons used for a modeling purpose violate the chrono gate."""
    seas = sorted({int(x) for x in seasons})
    if not seas and not allow_empty:
        raise ValueError(f"No seasons provided for purpose={purpose}")
    if purpose == "train":
        bad = [x for x in seas if x not in TRAIN_SEASONS]
        if bad:
            raise ValueError(f"Train may only use 2019–2021; forbidden={bad}")
    elif purpose == "val":
        bad = [x for x in seas if x not in VAL_SEASONS]
        if bad:
            raise ValueError(f"Validate may only use 2022; forbidden={bad}")
    elif purpose == "test":
        bad = [x for x in seas if x not in TEST_SEASONS]
        if bad:
            raise ValueError(f"Test may only use 2023–2025; forbidden={bad}")
    else:
        raise ValueError(f"Unknown purpose {purpose}")


def forbid_test_season_in_fit(seasons: Iterable[int], *, context: str) -> None:
    """Hard gate: 2023–2025 must never appear in fit/tune sets."""
    seas = {int(x) for x in seasons}
    leaked = sorted(seas & TEST_SEASONS)
    if leaked:
        raise ValueError(
            f"Test-season leakage in {context}: seasons {leaked} must not be used "
            "for fitting or hyperparameter tuning"
        )
    val_in_train = sorted(seas & VAL_SEASONS)
    if context.startswith("train") and val_in_train:
        raise ValueError(f"Validate seasons in train fit ({context}): {val_in_train}")
