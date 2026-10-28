"""Narrator: sentences cite only play-row fields, are deterministic, and are ≤25 words."""
import re

import pytest

from nfl_sim import narrator

ROWS = [
    dict(play_id=1, qtr=1, clock="9:12", posteam="DET", down=1, ydstogo=10, play_type="pass", home="KC", away="DET",
         text="J.Goff pass short right to A.St. Brown for 12 yards, TOUCHDOWN.", home_wp=0.6, home_wp_after=0.5,
         home_score=0, away_score=7, swing=True),
    dict(play_id=2, qtr=2, clock="0:04", posteam="KC", down=4, ydstogo=8, play_type="field_goal", home="KC",
         away="DET", text="H.Butker 49 yard field goal is GOOD", home_wp=0.5, home_wp_after=0.59, home_score=3,
         away_score=7, swing=True),
    dict(play_id=3, qtr=3, clock="11:40", posteam="KC", down=2, ydstogo=7, play_type="pass", home="KC", away="DET",
         text="P.Mahomes pass short left INTERCEPTED by B.Branch. TOUCHDOWN.", home_wp=0.62, home_wp_after=0.41,
         home_score=6, away_score=14, swing=True),
    dict(play_id=4, qtr=4, clock="2:01", posteam="DET", down=4, ydstogo=2, play_type="run", home="KC", away="DET",
         text="D.Montgomery right tackle for 3 yards", home_wp=0.3, home_wp_after=0.2, home_score=20, away_score=21,
         swing=True),
    dict(play_id=5, qtr=5, clock="5:00", posteam="DET", down=4, ydstogo=9, play_type="punt", home="KC", away="DET",
         text="J.Fox punts 50 yards", home_wp=0.45, home_wp_after=0.55, home_score=20, away_score=20, swing=True),
    dict(play_id=6, qtr=4, clock="0:30", posteam="KC", down=4, ydstogo=1, play_type="field_goal", home="KC",
         away="DET", text="H.Butker 52 yard field goal is No Good", home_wp=0.5, home_wp_after=0.2, home_score=20,
         away_score=21, swing=True),
]


def _allowed(row):
    f = narrator.facts(row)
    toks = set()
    for v in f.values():
        toks |= set(re.findall(r"[A-Za-z]+|\d+", v))
    return toks, f


@pytest.mark.parametrize("row", ROWS, ids=lambda r: str(r["play_id"]))
def test_sentence_references_only_row_fields(row):
    s = narrator.sentence(row)
    allowed, f = _allowed(row)
    # every number and team id in the sentence comes from facts(row)
    for n in re.findall(r"\d+", s):
        assert n in allowed, (n, s)
    for team in re.findall(r"\b[A-Z]{2,3}\b", s):
        assert team in {row["home"], row["away"]} and team in allowed, (team, s)
    # facts are derived from this row only: changing an unrelated row can't change it
    assert narrator.sentence(dict(row)) == s


@pytest.mark.parametrize("row", ROWS, ids=lambda r: str(r["play_id"]))
def test_short_and_deterministic(row):
    s = narrator.sentence(row)
    assert narrator.words(s) <= narrator.MAX_WORDS
    assert all(narrator.sentence(row) == s for _ in range(5))


def test_every_template_fits_with_long_values():
    worst = dict(team="JAX", opp="LAC", gainer="JAX", clock="15:00", period="the fourth quarter", swing="100",
                 gainer_wp="100", togo="99", score="99-99")
    for t in narrator.TEMPLATES.values():
        assert narrator.words(t.format(**worst)) <= narrator.MAX_WORDS


def test_story_three_to_five_in_game_order():
    st = narrator.story(ROWS)
    assert 3 <= len(st) <= 5
    assert st == narrator.story(ROWS)
    assert "intercepted" in " ".join(st)


def test_kind_classification():
    kinds = [narrator._kind(r) for r in ROWS]
    assert kinds == ["td", "fg_good", "interception", "fourth_go", "punt", "fg_miss"]
