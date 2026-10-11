"""API contract tests against synthetic canonical lake."""

from fastapi.testclient import TestClient

from nfl_sim.api.app import create_app
from nfl_sim.store import CanonicalStore


def test_list_and_get_games(synthetic_store):
    app = create_app(store=CanonicalStore(synthetic_store))
    client = TestClient(app)

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["store_ready"] is True
    assert health.json()["scope"] == "historical_replay_only"

    resp = client.get("/games", params={"season": 2023})
    assert resp.status_code == 200
    body = resp.json()
    assert body["truth_label"] == "historical"
    assert body["total"] == 2
    ids = {g["game_id"] for g in body["items"]}
    assert "2023_01_DET_KC" in ids

    game = client.get("/games/2023_01_DET_KC")
    assert game.status_code == 200
    g = game.json()
    assert g["home_team_id"] == "KC"
    assert g["away_team_id"] == "DET"
    assert g["truth_label"] == "historical"


def test_ordered_plays_pagination_and_reference_namespace(synthetic_store):
    app = create_app(store=CanonicalStore(synthetic_store))
    client = TestClient(app)

    page1 = client.get("/games/2023_01_DET_KC/plays", params={"limit": 2, "offset": 0})
    assert page1.status_code == 200
    b1 = page1.json()
    assert b1["total"] == 5
    assert len(b1["items"]) == 2
    assert [p["play_index"] for p in b1["items"]] == [0, 1]
    assert b1["truth_label"] == "historical"
    assert "reference" in b1["items"][1]
    assert b1["items"][1]["reference"]["ep"] is not None
    assert "imported nflverse" in b1["reference_disclaimer"].lower() or "nflverse" in b1["reference_disclaimer"]

    page2 = client.get("/games/2023_01_DET_KC/plays", params={"limit": 10, "offset": 2})
    assert [p["play_index"] for p in page2.json()["items"]] == [2, 3, 4]

    missing = client.get("/games/nope/plays")
    assert missing.status_code == 404


def test_field_position_and_clock_on_scrimmage_play(synthetic_store):
    app = create_app(store=CanonicalStore(synthetic_store))
    client = TestClient(app)
    plays = client.get("/games/2023_01_DET_KC/plays").json()["items"]
    scrimmage = next(p for p in plays if p["down"] is not None)
    assert 1 <= scrimmage["yardline_100"] <= 99
    assert scrimmage["half_seconds_remaining"] is not None
    assert scrimmage["game_seconds_remaining"] is not None
    # Kickoff keeps null down (missing stays missing)
    kick = next(p for p in plays if p["play_type"] == "kickoff")
    assert kick["down"] is None
