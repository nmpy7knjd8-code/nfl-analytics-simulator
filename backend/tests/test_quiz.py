"""Fourth-down quiz — offline pack + scoring (no duplicated WP math)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from nfl_sim.api.app import create_app
from nfl_sim.api.situation_lab import PRESETS
from nfl_sim.quiz.pack import load_curated_pack, public_pack, situation_public_view
from nfl_sim.quiz.scoring import score_quiz_choice, update_session_stats


def test_curated_pack_has_flip_and_at_least_five():
    pack = load_curated_pack()
    assert pack["live_feed"] is False or pack.get("offline") is True
    items = pack["items"]
    assert len(items) >= 5
    ids = {it["id"] for it in items}
    assert "flip-lac-den" in ids
    flip = next(it for it in items if it["id"] == "flip-lac-den")
    assert flip["source"]["game_id"] == "2022_18_LAC_DEN"
    assert float(flip["source"]["play_id"]) == 3897.0
    assert flip["reveal"]["recommendation"] == "punt"
    # No legacy→improved flip once the phantom 81-yd FG is gone (FG cap).
    assert flip["reveal"]["recommendation_changed_legacy_to_improved"] is False
    assert "fg" not in flip["reveal"]["values"]
    # At least one near-tie for partial-credit path
    assert any(it["reveal"].get("inconclusive") for it in items)


def test_public_pack_hides_reveal():
    pub = public_pack()
    assert pub["count"] >= 5
    assert pub["live_feed"] is False
    for it in pub["items"]:
        assert "reveal" not in it
        assert "situation" in it
        assert "values" not in it


def test_score_exact_near_tie_incorrect():
    pack = load_curated_pack()
    flip = next(it for it in pack["items"] if it["id"] == "flip-lac-den")
    near = next(it for it in pack["items"] if it["reveal"].get("inconclusive"))
    go_item = next(
        it
        for it in pack["items"]
        if it["reveal"]["recommendation"] == "go" and not it["reveal"].get("inconclusive")
    )

    ok = score_quiz_choice("punt", flip["reveal"])
    assert ok["result"] == "correct" and ok["credit"] == 1.0

    bad = score_quiz_choice("go", flip["reveal"])
    assert bad["result"] == "incorrect" and bad["credit"] == 0.0

    nt = score_quiz_choice("fg", near["reveal"])
    assert nt["result"] == "near_tie" and nt["credit"] == 0.5
    assert nt["inconclusive"] is True

    # Values come from reveal — not recomputed
    assert ok["values"] == flip["reveal"]["values"]

    session = None
    session = update_session_stats(session, ok)
    assert session["streak"] == 1 and session["exact"] == 1
    session = update_session_stats(session, bad)
    assert session["streak"] == 0 and session["incorrect"] == 1
    session = update_session_stats(session, score_quiz_choice("go", go_item["reveal"]))
    assert session["answered"] == 3
    assert 0.0 < session["accuracy"] < 1.0


def test_quiz_api_pack_and_score():
    client = TestClient(create_app())
    r = client.get("/situation-lab/api/quiz/pack")
    assert r.status_code == 200
    data = r.json()
    assert data["live_feed"] is False
    assert data["count"] >= 5
    assert all("reveal" not in it for it in data["items"])

    full = client.get("/situation-lab/api/quiz/pack/full")
    assert full.status_code == 200
    assert full.json()["hide_reveal_until_lock_in"] is True
    assert "reveal" in full.json()["items"][0]

    scored = client.post(
        "/situation-lab/api/quiz/score",
        json={"situation_id": "flip-lac-den", "choice": "punt", "session": {}},
    )
    assert scored.status_code == 200, scored.text
    body = scored.json()
    assert body["live_feed"] is False
    assert body["scored"]["result"] == "correct"
    assert body["session"]["exact"] == 1


def test_situation_lab_presets_still_intact():
    """Historical Situation Lab path must remain available alongside quiz."""
    assert any(p["id"] == "flip-lac-den" for p in PRESETS)
    client = TestClient(create_app())
    r = client.get("/situation-lab/api/presets")
    assert r.status_code == 200
    assert r.json()["default_id"] == "flip-lac-den"
    html = client.get("/situation-lab")
    assert html.status_code == 200
    assert "Situation Lab" in html.text


def test_situation_public_view_strips_reveal():
    pack = load_curated_pack()
    view = situation_public_view(pack["items"][0])
    assert "reveal" not in view
    assert view["id"] == pack["items"][0]["id"]
