"""Declined-flag full names, muffs not worded as fumbles, games-index weather; win chance untouched."""
import pandas as pd

from nfl_sim.play_text import display_text
from nfl_sim.products.games import index_rows, weather


def test_lone_declined_flag_uses_roster_full_name():
    r = {"game_id": "2024_02_ATL_PHI", "play_type": "no_play",
         "desc": "(2:00) Penalty on ATL-93-K.Street, Encroachment, declined.",
         "names": {"penalties": {"ATL-93": "Kentavius Street"}}}
    assert display_text(r) == "Flag on Kentavius Street (ATL) for encroachment, declined. No play."


def test_lone_declined_flag_falls_back_to_feed_name():
    r = {"play_type": "no_play", "desc": "(2:20) Penalty on IND-94-T.Lewis, Neutral Zone Infraction, declined.",
         "names": {}}
    assert "T.Lewis (IND)" in display_text(r)


def _muff(desc):
    return {"play_type": "punt", "fumble": 1, "fumble_lost": 0, "kick_distance": 40, "desc": desc,
            "punter_player_name": "J.Scott", "fumbled_1_player_name": "C.Beebe",
            "fumble_recovery_1_team": "MIN", "posteam": "GB"}


def test_muffed_punt_is_not_a_fumble():
    t = display_text(_muff("(9:36) 6-J.Scott punts 40 yards to MIN 21. 12-C.Beebe MUFFS catch, and recovers at MIN 21."))
    assert "muffs the catch" in t and "fumble" not in t.lower()


def test_muff_then_real_fumble_still_says_fumbles():
    t = display_text(_muff("6-J.Scott punts 40 yards. 12-C.Beebe MUFFS catch, and recovers. FUMBLES, recovered by MIN."))
    assert "fumbles" in t


def test_weather_only_for_open_air():
    assert weather({"roof": "outdoors", "wind": 12.0, "temp": 41.0}) == {"roof": "outdoors", "wind": 12, "temp": 41}
    assert weather({"roof": "dome", "wind": float("nan"), "temp": 70.0}) == {"roof": "dome", "wind": None, "temp": None}
    assert weather({"roof": "closed", "wind": 5, "temp": 68}) == {"roof": "closed", "wind": None, "temp": None}


def test_index_rows_carry_weather():
    s = pd.DataFrame([{"game_id": "2024_01_A_B", "season": 2024, "game_type": "REG", "week": 1, "gameday": "2024-09-08",
                       "home_team": "B", "away_team": "A", "home_score": 20, "away_score": 17, "overtime": 0,
                       "stadium": "X", "home_coach": "h", "away_coach": "a", "roof": "open", "wind": 8.0, "temp": 55.0}])
    row = index_rows(s, 2024)[0]
    assert (row["roof"], row["wind"], row["temp"]) == ("open", 8, 55)


def test_text_fix_leaves_win_chance_unchanged():
    """display_text changes never feed home_wp: game_doc win chances match with and without the new text."""
    from nfl_sim.products import games
    plays = pd.DataFrame([{"game_id": "2024_01_A_B", "play_id": 1, "qtr": 1, "quarter_seconds_remaining": 900,
                           "game_seconds_remaining": 3600, "posteam": "A", "down": None, "ydstogo": None,
                           "yardline_100": 65, "play_type": "punt", "home_wp": 0.5, "total_home_score": 0,
                           "total_away_score": 0, **_muff("6-J.Scott punts 40 yards. 12-C.Beebe MUFFS catch, and recovers.")},
                          {"game_id": "2024_01_A_B", "play_id": 2, "qtr": 1, "quarter_seconds_remaining": 880,
                           "game_seconds_remaining": 3580, "posteam": "B", "down": 1, "ydstogo": 10, "yardline_100": 79,
                           "play_type": "no_play", "home_wp": 0.47, "total_home_score": 0, "total_away_score": 0,
                           "desc": "(2:00) Penalty on ATL-93-K.Street, Encroachment, declined."}])
    game = {"id": "2024_01_A_B", "home": "B", "away": "A", "home_score": 20, "away_score": 17, "season_type": "REG"}
    orig = games.display_text
    try:
        new = games.game_doc(game, plays, {}, {})
        games.display_text = lambda r: "x"
        old = games.game_doc(game, plays, {}, {})
    finally:
        games.display_text = orig
    assert new != old
    for k in ("final_home_wp", "swing_play_ids", "wp_fallback_play_ids"):
        assert new[k] == old[k], k
    wp = ("play_id", "home_wp", "home_wp_after", "swing")
    assert [[p[k] for k in wp] for p in new["plays"]] == [[p[k] for k in wp] for p in old["plays"]]
    assert str(new.get("plays")).count("muffs the catch") == 1
