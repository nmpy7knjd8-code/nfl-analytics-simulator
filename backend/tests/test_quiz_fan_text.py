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


def _strings(node, key=None):
    """Yield (key, string value) for every string value in the pack."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield from _strings(v, k)
    elif isinstance(node, list):
        for v in node:
            yield from _strings(v, key)
    elif isinstance(node, str):
        yield key, node


def test_frontend_pack_has_no_model_details_anywhere():
    raw = PACKS[1].read_text()
    pack = json.loads(raw)
    for term in ("Path A", "isotonic", "WP"):
        assert term not in raw, term
    for it in pack["items"]:
        assert "model_notes" not in it["reveal"] and "edge_wp" not in it["reveal"]
    # Every string value is clean; 'yardline_100' appears only as the situation field
    # name the UI reads (ball position), never in any text.
    for key, text in _strings(pack):
        assert "yardline_100" not in text, (key, text)
    assert raw.count('"yardline_100"') == len(pack["items"])


def test_model_details_kept_in_backend_pack():
    for it in json.loads(QUIZ_PACK_PATH.read_text())["items"]:
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


def test_l7_about_the_same_only_lists_options_within_close_margin():
    """QA L7: no option named as 'about the same' may be >= CLOSE_MARGIN_WP below the best."""
    import json
    import re
    from pathlib import Path

    from nfl_sim.quiz.pack import _FAN_SHORT, CLOSE_MARGIN_WP

    root = Path(__file__).resolve().parents[2]
    for path in (root / "frontend/lib/quizPack.json", root / "backend/src/nfl_sim/quiz/data/curated_pack.json"):
        checked = 0
        for it in json.loads(path.read_text())["items"]:
            why, vals = it["reveal"]["layman_why"], it["reveal"]["values"]
            m = re.match(r"Close call: (.+?) give about the same", why)
            if not m:
                continue
            checked += 1
            best = max(vals.values())
            for k, label in _FAN_SHORT.items():
                if k in vals and label in m.group(1):
                    assert best - vals[k] < CLOSE_MARGIN_WP, (it["id"], k, why)
        assert checked > 0
    from nfl_sim.quiz.pack import fan_why
    why = fan_why({"inconclusive": True, "recommendation": "inconclusive",
                   "values": {"go": 0.6167, "punt": 0.5129, "fg": 0.6207}})
    assert why == "Close call: a field goal and going for it give about the same win chance (around 62%); punting is lower (51%)."
