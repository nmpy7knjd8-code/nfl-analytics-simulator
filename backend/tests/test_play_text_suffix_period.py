"""Analyte recheck 2026-11-04 03:20: no doubled period after a name suffix ("Chris Godwin Jr..")."""
from nfl_sim.play_text import _period, display_text


def test_period_added_once():
    assert _period("Baker Mayfield pass incomplete, intended for Chris Godwin Jr.") == "Baker Mayfield pass incomplete, intended for Chris Godwin Jr."
    assert _period("Jalen Hurts runs for 4 yards") == "Jalen Hurts runs for 4 yards."


def test_incomplete_pass_to_chris_godwin_jr():  # 2024_04_PHI_TB
    r = {"play_type": "pass", "incomplete_pass": 1, "yards_gained": 0, "passer_player_name": "B.Mayfield",
         "receiver_player_name": "C.Godwin",
         "names": {"passer": "Baker Mayfield", "receiver": "Chris Godwin Jr."},
         "desc": "(10:00) 6-B.Mayfield pass incomplete short right to 14-C.Godwin."}
    t = display_text(r)
    assert "Chris Godwin Jr." in t, t
    assert ".." not in t, t
