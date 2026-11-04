"""Situation Lab API — offline compare over decision-lab harness (not fan UI)."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from nfl_sim.api.app import create_app
from nfl_sim.api.situation_lab import PRESETS, WP_MODEL_ARTIFACT, build_situation_lab_payload
from nfl_sim.config import REPO_ROOT


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app())


def test_presets_include_documented_flip(client: TestClient):
    r = client.get("/situation-lab/api/presets")
    assert r.status_code == 200
    data = r.json()
    assert data["fan_ui"] is False
    assert data["default_id"] == "flip-lac-den"
    ids = {p["id"] for p in data["items"]}
    assert "flip-lac-den" in ids and "anchor-bal-nyj" in ids
    flip = next(p for p in data["items"] if p["id"] == "flip-lac-den")
    assert flip["game_id"] == "2022_18_LAC_DEN"
    assert float(flip["play_id"]) == 3897.0


def test_situation_lab_html_served(client: TestClient):
    r = client.get("/situation-lab")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")
    body = r.text
    assert "Situation Lab" in body
    assert "not the fan UI" in body
    assert "/situation-lab/api/compare" in body


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_compare_flip_play_changes_recommendation(client: TestClient):
    # Requires local lake + WP (same as decision-lab CLI).
    lake = REPO_ROOT / "data" / "raw" / "pbp" / "season=2022" / "play_by_play.parquet"
    if not lake.exists():
        pytest.skip("lake season 2022 missing")
    r = client.get(
        "/situation-lab/api/compare",
        params={"season": 2022, "game_id": "2022_18_LAC_DEN", "play_id": 3897},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["offline"] is True
    assert data["play"]["provenance"]["game_id"] == "2022_18_LAC_DEN"
    assert data["recommendation_changed_legacy_to_improved"] is False  # was True only via a phantom 81-yd FG (yardline 64 + 17); FG now out of range
    assert data["configs"]["pooled_legacy"]["recommendation"] in ("punt", "inconclusive")  # H6: near tie
    assert data["configs"]["pooled_improved"]["recommendation"] in ("punt", "inconclusive")  # H6: near tie
    for cfg in data["configs"].values():
        assert "fg" not in cfg["values"] and cfg["p_make"] == 0.0
    assert data["configs"]["pooled_improved"]["empirics_seasons"] == [2019, 2020, 2021]
    assert data["configs"]["pooled_improved"]["punt_buckets"]
    assert data["clock_deltas_improved"]["go_convert"] == 29


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_build_payload_anchor_stable():
    lake = REPO_ROOT / "data" / "raw" / "pbp" / "season=2022" / "play_by_play.parquet"
    if not lake.exists():
        pytest.skip("lake season 2022 missing")
    data = build_situation_lab_payload(
        season=2022, game_id="2022_01_BAL_NYJ", play_id=368
    )
    assert data["recommendation_changed_legacy_to_improved"] is False
    assert data["configs"]["pooled_legacy"]["recommendation"] == "go"
    assert data["configs"]["pooled_improved"]["recommendation"] == "go"


def test_presets_constant_default():
    from nfl_sim.api.situation_lab import STATIC_HTML

    assert any(p.get("default") for p in PRESETS)
    assert STATIC_HTML.exists()

