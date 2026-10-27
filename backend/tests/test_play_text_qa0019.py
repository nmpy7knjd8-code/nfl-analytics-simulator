"""QA 2026-10-27 00:19 N3-N7: play_text on real nflverse pbp rows (trimmed to the columns play_text reads)."""
from nfl_sim.play_text import display_text, penalty_text


def test_n3_offsetting_on_a_play_that_stood_is_not_replayed():
    r = {"play_type": "run", "rusher_player_name": "D.Montgomery", "yards_gained": 0, "penalty": 1,
         "desc": "(12:50) 5-D.Montgomery right guard to DET 7 for no gain (56-G.Karlaftis). Penalty on DET-72-H.Vaitai, "
                 "Unnecessary Roughness, offsetting. PENALTY on KC-93-M.Dickerson, Unnecessary Roughness, offsetting."}
    assert "replayed" not in (penalty_text(r) or "")
    assert penalty_text({**r, "play_type": "no_play"}) is None or "replayed" in display_text({**r, "play_type": "no_play"})


def test_n4_blocked_punt_touchdown():  # 2022_15_IND_MIN 442
    r = {"play_type": "punt", "punt_blocked": 1, "touchdown": 1, "punter_player_name": "R.Wright", "kick_distance": 0,
         "blocked_player_name": "I.Odenigbo",
         "desc": "(8:20) 14-R.Wright punt is BLOCKED by 59-I.Odenigbo, Center-42-A.DePaola, RECOVERED by IND-57-J.Domann "
                 "at MIN 24. 57-J.Domann for 24 yards, TOUCHDOWN."}
    assert display_text(r) == "R.Wright's punt is blocked by I.Odenigbo, and the defense scores a touchdown."


def test_n4_fumble_return_touchdowns():  # 2019_10_SEA_SF 1618, 3345
    base = {"play_type": "pass", "sack": 1, "fumble": 1, "fumble_lost": 1, "touchdown": 1, "yards_gained": -9,
            "passer_player_name": "J.Garoppolo", "fumbled_1_player_name": "J.Garoppolo", "desc": "x"}
    assert display_text({**base, "fumble_recovery_1_player_name": "J.Clowney", "td_player_name": "J.Clowney"}) == (
        "J.Garoppolo fumbles, and J.Clowney recovers and scores a touchdown.")
    assert display_text({**base, "fumbled_1_player_name": "R.Wilson", "fumble_recovery_1_player_name": "G.Ifedi",
                         "td_player_name": "D.Buckner"}) == "R.Wilson fumbles, and D.Buckner returns it for a touchdown."


def test_n5_center_and_holder_stripped_before_jersey_numbers():
    r = {"play_type": "punt", "desc": "(5:00) 4-M.Dickson punts 52 yards to SF 16, Center-48-T.Ott. 10-X.Yy to SF 20 "
                                       "for 4 yards (1-A.Bb)."}
    assert ".Ott" not in display_text(r) and "Ott" not in display_text(r)


def test_n6_one_yard_penalty_no_play():  # 2022_13_CLE_HOU 1191
    r = {"play_type": "no_play", "desc": "(12:25) 74-C.Hubbard reported in as eligible. PENALTY on CLE-77-W.Teller, "
                                         "False Start, 1 yard, enforced at CLE 2 - No Play."}
    assert display_text(r) == "Penalty on W.Teller (CLE): false start, 1 yard. No play."


def test_n7_kickoff_return_yards_from_feed_and_muffs():
    k = {"play_type": "kickoff", "kicker_player_name": "N.Folk", "kick_distance": 67, "kickoff_returner_player_name":
         "D.Pierce", "return_yards": 30, "penalty": 1,
         "desc": "6-N.Folk kicks 67 yards from TEN 35 to HOU -2. 31-D.Pierce to HOU 46 for 48 yards (51-C.Gray). "
                 "PENALTY on HOU-29-M.Stewart, Offensive Holding, 10 yards, enforced at HOU 28."}
    assert display_text(k) == "N.Folk kicks off 67 yards, and D.Pierce returns it 48 yards."
    assert penalty_text(k) == "Penalty on HOU: offensive holding, 10 yards against HOU."
    m = {"play_type": "kickoff", "kicker_player_name": "E.McPherson", "kick_distance": 57, "return_yards": 0,
         "kickoff_returner_player_name": "C.Collier",
         "desc": "2-E.McPherson kicks 57 yards from CIN 35 to BAL 8. 38-C.Collier MUFFS catch, ball out of bounds at BAL 8."}
    assert display_text(m) == "E.McPherson kicks off 57 yards, and C.Collier muffs the catch."


def test_n7_pass_with_penalty_uses_feed_yards():  # 2019_10_SEA_SF 2902
    r = {"play_type": "pass", "passer_player_name": "J.Garoppolo", "receiver_player_name": "D.Samuel", "yards_gained": 2,
         "penalty": 1, "desc": "(4:14) (Shotgun) 10-J.Garoppolo pass short right to 19-D.Samuel to 50 for 10 yards "
                               "(30-B.McDougald). PENALTY on SF-84-K.Bourne, Offensive Holding, 10 yards, enforced at SF 42."}
    assert display_text(r) == "J.Garoppolo completes a pass to D.Samuel for 10 yards."
    assert "holding" in penalty_text(r)
