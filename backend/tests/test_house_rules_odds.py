"""house_rules betting regex: flags odds-style text, not coach values."""
import importlib.util
from pathlib import Path

import pytest

_p = Path(__file__).resolve().parents[2] / "scripts/acceptance/house_rules.py"
_spec = importlib.util.spec_from_file_location("house_rules", _p)
hr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hr)


@pytest.mark.parametrize("text", [
    "Bills ML -150", "the line is +130", "spread -110", "odds +250",
    "-150 / +130", "+200 odds", "\u2212110 line", "moneyline", "place a bet",
])
def test_flags_odds_text(text):
    assert hr.BETTING.search(text)


@pytest.mark.parametrize("text", [
    "Coach value +293.5", "coach value -136", "Going for it: +293.5 vs punt -136",
    "-136 in coach value", "a +120 swing in coach value", "+150 yards", "Close call",
    "line of scrimmage at the 35",
])
def test_ignores_coach_values(text):
    assert not hr.BETTING.search(text), hr.BETTING.search(text)
