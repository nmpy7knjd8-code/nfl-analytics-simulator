"""house_rules data filter: flags only the bad 2019_03_CIN_BUF rows, not the whole game."""
import importlib.util
from pathlib import Path

_p = Path(__file__).resolve().parents[2] / "scripts/acceptance/house_rules.py"
_spec = importlib.util.spec_from_file_location("house_rules", _p)
hr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hr)

G = hr.BAD_GAME
END = "End of half - BUF 7, CIN 0"
DALTON = "(:02) (Shotgun) 14-A.Dalton pass deep right to 19-A.Tate to BUF 30 for 40 yards"


def test_other_plays_from_the_game_pass():
    data = {"plays": [{"game_id": G, "play_index": 5, "description": "(8:00) J.Allen pass short left"}],
            "swings": [{"game_id": G, "desc": "(3:10) D.Singletary up the middle"}]}
    assert list(hr.bad_rows(data)) == []


def test_end_of_half_row_fails():
    data = {"plays": [{"game_id": G, "play_index": 40, "description": END}]}
    assert list(hr.bad_rows(data)) == ["$.plays[0].description"]


def test_play_before_end_of_half_fails():
    data = {"weeks": {"2019-w03": {"game_id": G, "desc": DALTON}}}
    assert list(hr.bad_rows(data)) == ["$.weeks.2019-w03.desc"]


def test_end_of_half_in_other_games_passes():
    data = {"plays": [{"game_id": "2019_03_NYG_TB", "description": END}]}
    assert list(hr.bad_rows(data)) == []
