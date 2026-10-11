"""Chronological split hard gate — 2023 never in fit/tune."""

import pytest

from nfl_sim.models.split import (
    assert_split_integrity,
    forbid_test_season_in_fit,
    season_to_split,
)


def test_season_mapping():
    assert season_to_split(2019) == "train"
    assert season_to_split(2021) == "train"
    assert season_to_split(2022) == "val"
    assert season_to_split(2023) == "test"
    assert season_to_split(2018) is None


def test_forbid_2023_in_train():
    with pytest.raises(ValueError, match="Test-season leakage"):
        forbid_test_season_in_fit([2019, 2020, 2023], context="train_fit")


def test_forbid_val_in_train_context():
    with pytest.raises(ValueError, match="Validate seasons"):
        forbid_test_season_in_fit([2019, 2022], context="train_fit")


def test_assert_split_integrity_ok():
    assert_split_integrity([2019, 2020, 2021], purpose="train")
    assert_split_integrity([2022], purpose="val")
    assert_split_integrity([2023], purpose="test")


def test_assert_split_integrity_rejects():
    with pytest.raises(ValueError):
        assert_split_integrity([2022], purpose="train")
    with pytest.raises(ValueError):
        assert_split_integrity([2023], purpose="val")
    with pytest.raises(ValueError):
        assert_split_integrity([2021], purpose="test")
