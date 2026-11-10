"""QA 2026-10-27 02:17 A/C/G/H: play_text on real nflverse pbp rows (trimmed to the columns play_text reads)."""
from nfl_sim.play_text import display_text, penalty_text


def test_a_touchdown_reversed_on_replay_reads_as_touchback():  # 2025_05_TEN_ARI 3612
    r = {"play_type": "run", "touchdown": 0, "fumble": 1, "fumble_lost": 1, "yards_gained": 71,
         "rusher_player_name": "E.Demercado", "fumbled_1_player_name": "E.Demercado", "fumble_recovery_1_team": None,
         "desc": "(12:51) 68-K.Beachum reported in as eligible. 31-E.Demercado up the middle for 72 yards, TOUCHDOWN. "
                 "The Replay Official reviewed the runner broke the plane ruling, and the play was REVERSED. "
                 "68-K.Beachum reported in as eligible. 31-E.Demercado up the middle to TEN 1 for 71 yards. "
                 "FUMBLES, ball out of bounds in End Zone, Touchback."}
    t = display_text(r)
    assert t == "E.Demercado runs for 71 yards, but he fumbles out of the end zone for a touchback."
    assert "touchdown" not in t.lower() and "reported" not in t


def test_a_reversal_drops_the_overturned_penalty():  # 2019_04_PHI_GB 1079: OPI reversed, TD stands
    r = {"play_type": "pass", "touchdown": 1, "yards_gained": 6, "penalty": 0, "passer_player_name": "C.Wentz",
         "receiver_player_name": "A.Jeffery",
         "desc": "(11:52) 11-C.Wentz pass short middle to 17-A.Jeffery for 6 yards, TOUCHDOWN NULLIFIED by Penalty. "
                 "PENALTY on PHI-86-Z.Ertz, Offensive Pass Interference, 10 yards, enforced at GB 6 - No Play. The Replay "
                 "Official reviewed the offensive pass interference ruling, and the play was REVERSED. 11-C.Wentz pass "
                 "short middle to 17-A.Jeffery for 6 yards, TOUCHDOWN."}
    assert display_text(r) == "C.Wentz throws a 6-yard touchdown pass to A.Jeffery."
    assert not penalty_text(r)


def test_c_muffed_punt_kicking_team_recovers():  # 2022_04_CHI_NYG 3682
    r = {"play_type": "punt", "fumble": 1, "fumble_lost": 1, "kick_distance": 59, "punter_player_name": "J.Gillan",
         "fumbled_1_player_name": "V.Jones", "fumble_recovery_1_player_name": "G.Brightwell",
         "fumble_recovery_1_team": "NYG", "posteam": "NYG",
         "desc": "(2:13) 6-J.Gillan punts 59 yards to CHI 34, Center-58-C.Kreiter. 12-V.Jones MUFFS catch, touched at "
                 "CHI 34, RECOVERED by NYG-23-G.Brightwell at CHI 37."}
    assert display_text(r) == "J.Gillan punts 59 yards, and V.Jones muffs the catch. NYG recovers."


def test_c_punt_fumbled_on_return():  # 2022_04_CHI_NYG 1503
    r = {"play_type": "punt", "fumble": 1, "fumble_lost": 1, "kick_distance": 50, "punter_player_name": "T.Gill",
         "fumbled_1_player_name": "R.James", "fumble_recovery_1_team": "CHI", "posteam": "CHI",
         "desc": "(4:02) 16-T.Gill punts 50 yards to NYG 30. 80-R.James to NYG 35 for 5 yards. FUMBLES, RECOVERED by "
                 "CHI-39-J.Blackwell at NYG 35."}
    assert display_text(r) == "T.Gill punts 50 yards, and R.James fumbles on the return. CHI recovers."


def test_g_lone_declined_flag_is_plain():  # 2019_04_CAR_HOU 2722
    r = {"play_type": None, "desc": "(5:11) (Punt formation) Penalty on CAR-42-C.Jones, False Start, declined."}
    assert display_text(r) == "Flag on C.Jones (CAR) for false start, declined. No play."
    assert penalty_text(r) is None


def test_h_aborted_snap_says_where_and_the_loss():  # 2023_01_DET_KC 1273: KC 17 -> KC 27, next 2nd & 20
    r = {"play_type": "run", "fumble": 1, "fumble_lost": 0, "yards_gained": 0, "yardline_100": 17, "posteam": "DET",
         "rusher_player_name": "J.Goff", "fumbled_1_player_name": "F.Ragnow", "fumble_recovery_1_player_name": "J.Goff",
         "desc": "(6:44) (Shotgun) 16-J.Goff Aborted. 77-F.Ragnow FUMBLES at KC 24, recovered by DET-16-J.Goff at "
                 "KC 27. 16-J.Goff to KC 27 for no gain (56-G.Karlaftis)."}
    t = display_text(r)
    assert t == "Botched snap: F.Ragnow fumbles, and J.Goff recovers at KC 27, a loss of 10 yards."
    assert "no gain" not in t
