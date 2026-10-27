"""Simple-game score bug: quiz/daily pack situations carry home/away score before the snap and the clock."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKS = (ROOT / "frontend/lib/quizPack.json", ROOT / "backend/src/nfl_sim/quiz/data/curated_pack.json")


def test_quiz_situations_have_scoreboard_fields():
    for path in PACKS:
        for it in json.loads(path.read_text())["items"]:
            s = it["situation"]
            home = s["posteam"] == s["home_team"]
            assert s["home_team"] in (s["posteam"], s["defteam"]) and s["away_team"] in (s["posteam"], s["defteam"])
            assert (s["home_score_before"], s["away_score_before"]) == (
                (s["posteam_score"], s["defteam_score"]) if home else (s["defteam_score"], s["posteam_score"]))
            q = s["quarter_seconds_remaining"]
            assert s["clock"] == f"{q // 60}:{q % 60:02d}"
            assert 1 <= s["qtr"] <= 5 and 1 <= s["yardline_100"] <= 99
            for k in ("posteam_timeouts", "defteam_timeouts"):
                assert s[k] is None or 0 <= s[k] <= 3
