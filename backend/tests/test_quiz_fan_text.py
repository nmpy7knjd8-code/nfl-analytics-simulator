"""QA2 H3: quiz display text must be fan language; model details stay in hidden fields."""
import json
from pathlib import Path

import pytest

from nfl_sim.quiz.pack import BANNED_DISPLAY_TERMS, QUIZ_PACK_PATH, fanify_reveal

REPO = Path(__file__).resolve().parents[2]
PACKS = [QUIZ_PACK_PATH, REPO / "frontend" / "lib" / "quizPack.json"]


def _displayed(item):
    rv = item["reveal"]
    return [item["label"], rv["layman_why"], *rv.get("assumptions", [])]


@pytest.mark.parametrize("path", PACKS, ids=lambda p: p.name)
def test_no_model_jargon_in_displayed_text(path):
    items = json.loads(path.read_text())["items"]
    assert len(items) == 365
    for it in items:
        for text in _displayed(it):
            for term in BANNED_DISPLAY_TERMS:
                assert term not in text, f"{it['id']}: {term!r} in {text!r}"


@pytest.mark.parametrize("path", PACKS, ids=lambda p: p.name)
def test_model_details_kept_in_hidden_fields(path):
    for it in json.loads(path.read_text())["items"]:
        rv = it["reveal"]
        assert "edge_wp" in rv and rv["model_notes"]
        if rv["margin"] is not None:
            assert rv["edge_wp"] == pytest.approx(rv["margin"])


def test_fanify_is_idempotent_and_plain():
    rv = {"recommendation": "go", "inconclusive": False, "margin": 0.031,
          "values": {"go": 0.51, "punt": 0.479},
          "layman_why": "x (edge ≈ 0.031 WP)", "assumptions": ["Path A uncalibrated WP only (no isotonic)"]}
    fanify_reveal(rv)
    once = json.dumps(rv, sort_keys=True)
    fanify_reveal(rv)
    assert json.dumps(rv, sort_keys=True) == once
    assert rv["layman_why"].startswith("Going for it added about 3% win chance")
    assert rv["model_notes"] == ["Path A uncalibrated WP only (no isotonic)"]
