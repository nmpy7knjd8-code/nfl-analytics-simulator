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


def test_missing_user_fallbackable_without_fallback_unsupported(flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    del bad["situation"]["distance"]
    with pytest.raises(PreSnapAdapterError) as exc:
        parse_pre_snap_snapshot(bad)
    msg = str(exc.value).lower()
    assert "distance" in msg
    assert "unsupported-state" in msg


def test_missing_auto_field_unsupported_state(flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    del bad["situation"]["receive_2h_ko"]
    with pytest.raises(PreSnapAdapterError) as exc:
        parse_pre_snap_snapshot(bad)
    msg = str(exc.value).lower()
    assert "receive_2h_ko" in msg
    assert "unsupported-state" in msg


def test_user_fallback_rejects_auto_only_keys(flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    bad["user_fallback"] = {"posteam_timeouts": 2}
    with pytest.raises(PreSnapAdapterError) as exc:
        parse_pre_snap_snapshot(bad)
    assert "posteam_timeouts" in str(exc.value).lower()


def test_user_fallback_fills_time_down_field_position(flip_raw: dict):
    partial = copy.deepcopy(flip_raw)
    for key in (
        "down",
        "distance",
        "yardline_100",
        "quarter",
        "half_seconds_remaining",
        "game_seconds_remaining",
    ):
        del partial["situation"][key]
    partial["user_fallback"] = {
        "down": 4,
        "distance": 14,
        "yardline_100": 64,
        "quarter": 4,
        "half_seconds_remaining": 207,
        "game_seconds_remaining": 207,
    }
    snap = parse_pre_snap_snapshot(partial)
    assert snap.situation.distance == 14
    assert snap.field_sources["distance"] == "user_fallback"
    assert snap.field_sources["posteam_timeouts"] == "snapshot"
    assert snap.field_sources["yardline_100"] == "user_fallback"


def test_conflict_snapshot_and_user_fallback_rejected(flip_raw: dict):
    bad = copy.deepcopy(flip_raw)
    bad["user_fallback"] = {"distance": 10}
    with pytest.raises(PreSnapAdapterError) as exc:
        parse_pre_snap_snapshot(bad)
    assert "conflict" in str(exc.value).lower()


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
    assert a["recommendation_changed_legacy_to_improved"] is False  # was True only via a phantom 81-yd FG (yardline 64 + 17); FG now out of range
    # H6 WP model (score×time term): this snapshot is now a near tie, so either label is right.
    assert a["configs"]["pooled_legacy"]["recommendation"] in ("punt", "inconclusive")
    assert a["configs"]["pooled_improved"]["recommendation"] in ("punt", "inconclusive")
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
    assert a["field_sources"]["distance"] == "snapshot"
    assert a["field_sources"]["posteam_timeouts"] == "snapshot"


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_historical_path_still_works():
    if not LAKE_2022.exists():
        pytest.skip("lake season 2022 missing")
    data = build_situation_lab_payload(
        season=2022, game_id="2022_18_LAC_DEN", play_id=3897
    )
    assert data["truth_labels"]["play"] == "historical"
    assert data["recommendation_changed_legacy_to_improved"] is False  # was True only via a phantom 81-yd FG (yardline 64 + 17); FG now out of range
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
    assert data["recommendation_changed_legacy_to_improved"] is False  # was True only via a phantom 81-yd FG (yardline 64 + 17); FG now out of range
    assert data["configs"]["pooled_improved"]["recommendation"] in ("punt", "inconclusive")  # H6: near tie
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


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_api_user_fallback_partial_e2e(client: TestClient, flip_raw: dict):
    body = copy.deepcopy(flip_raw)
    for key in (
        "down",
        "distance",
        "yardline_100",
        "quarter",
        "half_seconds_remaining",
        "game_seconds_remaining",
    ):
        del body["situation"][key]
    body["user_fallback"] = {
        "down": 4,
        "distance": 14,
        "yardline_100": 64,
        "quarter": 4,
        "half_seconds_remaining": 207,
        "game_seconds_remaining": 207,
    }
    r = client.post("/situation-lab/api/compare-pre-snap", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["field_sources"]["yardline_100"] == "user_fallback"
    assert data["field_sources"]["game_id"] == "snapshot"
    assert data["recommendation_changed_legacy_to_improved"] is False  # was True only via a phantom 81-yd FG (yardline 64 + 17); FG now out of range
    assert data["live_feed"] is False


def test_fixture_json_roundtrip_stable():
    path = FIXTURES_DIR / "flip_lac_den_pre_snap.json"
    raw1 = json.loads(path.read_text(encoding="utf-8"))
    raw2 = json.loads(path.read_text(encoding="utf-8"))
    assert raw1 == raw2
    assert raw1["schema_version"] == "pre_snap_snapshot.v1"
