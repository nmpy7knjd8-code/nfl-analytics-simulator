"""Pre-snap adapter — validation, freshness, determinism, Situation Lab E2E."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from nfl_sim.api.app import create_app
from nfl_sim.api.situation_lab import (
    WP_MODEL_ARTIFACT,
    build_situation_lab_payload,
    build_situation_lab_payload_from_snapshot,
)
from nfl_sim.config import REPO_ROOT
from nfl_sim.providers.pre_snap import (
    FIXTURES_DIR,
    PreSnapAdapterError,
    load_fixture,
    parse_pre_snap_snapshot,
    snapshot_to_decision_row,
)

FLIP_ID = "flip-lac-den-pre-snap"
LAKE_2022 = REPO_ROOT / "data" / "raw" / "pbp" / "season=2022" / "play_by_play.parquet"


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app())


@pytest.fixture()
def flip_raw() -> dict:
    return load_fixture(FLIP_ID)


def test_fixture_file_exists_and_parses(flip_raw: dict):
    assert (FIXTURES_DIR / "flip_lac_den_pre_snap.json").is_file()
    snap = parse_pre_snap_snapshot(flip_raw)
    assert snap.source.provider.value == "fixture"
    assert snap.source.freshness.value == "pre_snap"
    assert snap.situation.down == 4
    assert snap.situation.distance == 14


def test_missing_required_field_not_zero_filled(flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    del bad["situation"]["distance"]
    with pytest.raises(PreSnapAdapterError) as exc:
        parse_pre_snap_snapshot(bad)
    assert "distance" in str(exc.value).lower()


def test_missing_receive_2h_ko_rejected(flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    del bad["situation"]["receive_2h_ko"]
    with pytest.raises(PreSnapAdapterError) as exc:
        parse_pre_snap_snapshot(bad)
    assert "receive_2h_ko" in str(exc.value)


def test_inconsistent_score_rejected(flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    bad["situation"]["score_differential"] = 0  # should be -3
    with pytest.raises(PreSnapAdapterError) as exc:
        parse_pre_snap_snapshot(bad)
    assert "score_differential" in str(exc.value)


def test_freshness_in_play_rejects(flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    bad["source"]["freshness"] = "in_play"
    with pytest.raises(PreSnapAdapterError) as exc:
        snapshot_to_decision_row(bad)
    assert "in_play" in str(exc.value)


def test_freshness_stale_rejects(flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    bad["source"]["freshness"] = "stale"
    with pytest.raises(PreSnapAdapterError) as exc:
        snapshot_to_decision_row(bad)
    assert "stale" in str(exc.value)


def test_snapshot_row_has_no_play_outcome(flip_raw: dict):
    row = snapshot_to_decision_row(flip_raw)
    assert row["play_type"] is None
    assert row["game_id"] == "2022_18_LAC_DEN"
    assert float(row["play_id"]) == 3897.0


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_deterministic_fixture_payload(flip_raw: dict):
    a = build_situation_lab_payload_from_snapshot(flip_raw)
    b = build_situation_lab_payload_from_snapshot(copy.deepcopy(flip_raw))
    assert a["configs"] == b["configs"]
    assert a["recommendation_changed_legacy_to_improved"] is True
    assert a["configs"]["pooled_legacy"]["recommendation"] == "inconclusive"
    assert a["configs"]["pooled_improved"]["recommendation"] == "punt"
    assert a["truth_labels"]["play"] == "pre_snap_fixture"
    assert a["live_feed"] is False
    assert a["offline"] is True
    assert a["source"]["provider"] == "fixture"
    assert a["source"]["freshness"] == "pre_snap"
    assert a["play"]["historical_action"] is None
    assert "live" not in a["truth_labels"]["disclaimer"].lower() or "not a live" in a[
        "truth_labels"
    ]["disclaimer"].lower()
    assert a["live_feed"] is False


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_historical_path_still_works():
    if not LAKE_2022.exists():
        pytest.skip("lake season 2022 missing")
    data = build_situation_lab_payload(
        season=2022, game_id="2022_18_LAC_DEN", play_id=3897
    )
    assert data["truth_labels"]["play"] == "historical"
    assert data["recommendation_changed_legacy_to_improved"] is True
    assert data["live_feed"] is False


def test_api_list_fixtures(client: TestClient):
    r = client.get("/situation-lab/api/fixtures")
    assert r.status_code == 200
    data = r.json()
    assert data["live_feed"] is False
    assert data["fan_ui"] is False
    ids = {i["id"] for i in data["items"]}
    assert FLIP_ID in ids


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_api_compare_pre_snap_fixture_e2e(client: TestClient):
    r = client.get(
        "/situation-lab/api/compare-pre-snap",
        params={"fixture_id": FLIP_ID},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["truth_labels"]["play"] == "pre_snap_fixture"
    assert data["live_feed"] is False
    assert data["recommendation_changed_legacy_to_improved"] is True
    assert data["configs"]["pooled_improved"]["recommendation"] == "punt"
    assert data["source"]["snapshot_id"] == "fixture-flip-lac-den-v1"


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_api_compare_pre_snap_post(client: TestClient, flip_raw: dict):
    r = client.post("/situation-lab/api/compare-pre-snap", json=flip_raw)
    assert r.status_code == 200, r.text
    assert r.json()["live_feed"] is False


def test_api_rejects_stale(client: TestClient, flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    bad["source"]["freshness"] = "stale"
    r = client.post("/situation-lab/api/compare-pre-snap", json=bad)
    assert r.status_code == 400
    assert "stale" in r.json()["detail"].lower()


def test_api_rejects_missing_field(client: TestClient, flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    del bad["situation"]["yardline_100"]
    r = client.post("/situation-lab/api/compare-pre-snap", json=bad)
    assert r.status_code == 400
    assert "yardline_100" in r.json()["detail"].lower()


def test_fixture_json_roundtrip_stable():
    path = FIXTURES_DIR / "flip_lac_den_pre_snap.json"
    raw1 = json.loads(path.read_text(encoding="utf-8"))
    raw2 = json.loads(path.read_text(encoding="utf-8"))
    assert raw1 == raw2
    assert raw1["schema_version"] == "pre_snap_snapshot.v1"
