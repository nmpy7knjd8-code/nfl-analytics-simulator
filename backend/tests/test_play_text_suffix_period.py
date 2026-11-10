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


def test_fit_does_not_split_after_initials():  # 2019_06_TEN_DEN 572 (QA #328 initials)
    from nfl_sim.play_text import _fit
    s = ("Marcus Mariota completes a pass to A.J. Brown for 13 yards. "
         "A.J. Brown fumbles out of bounds; TEN keeps the ball.")
    assert _fit(s) == "Marcus Mariota completes a pass to A.J. Brown for 13 yards."


def test_kept_fumble_after_long_catch_names_the_player_once():
    r = {"play_type": "pass", "complete_pass": 1, "yards_gained": 13, "fumble": 1, "fumble_lost": 0,
         "passer_player_name": "M.Mariota", "receiver_player_name": "A.Brown", "fumbled_1_player_name": "A.Brown",
         "posteam": "TEN", "names": {"passer": "Marcus Mariota", "receiver": "A.J. Brown", "fumbled_1": "A.J. Brown"},
         "desc": "(5:44) (Shotgun) 8-M.Mariota pass short right to 11-A.Brown to TEN 28 for 13 yards (25-C.Harris). "
                 "FUMBLES (25-C.Harris), ball out of bounds at TEN 28."}
    t = display_text(r)
    assert "A.J. A.J." not in t and t.endswith("A.J. Brown fumbles."), t
