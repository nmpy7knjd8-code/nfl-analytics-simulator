"""Recorded-frame demo provider — sequencing, freshness, fallback, historical path."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from nfl_sim.api.app import create_app
from nfl_sim.api.situation_lab import WP_MODEL_ARTIFACT, layman_why_from_config
from nfl_sim.providers.pre_snap import PreSnapAdapterError
from nfl_sim.providers.recorded_demo import (
    advance_index,
    get_frame,
    list_sequences,
    missing_allowlist_fields,
    prepare_snapshot_for_score,
    sequence_summary,
)

SEQ = "lac-den-q4-demo"


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app())


def test_sequence_registered_and_timestamped():
    items = list_sequences()
    assert any(i["id"] == SEQ and i["live_feed"] is False for i in items)
    summary = sequence_summary(SEQ)
    assert summary["frame_count"] == 5
    assert summary["live_feed"] is False
    assert summary["provider"] == "demo"
    ts = [f["event_timestamp"] for f in summary["frames"]]
    assert ts == sorted(ts)
    assert summary["frames"][0]["freshness"] == "pre_snap"
    assert summary["frames"][3]["freshness"] == "stale"
    assert "distance" in summary["frames"][2]["missing_allowlist"]


def test_advance_index_deterministic():
    assert advance_index(SEQ, 0, delta=1) == 1
    assert advance_index(SEQ, 2, delta=-1) == 1
    with pytest.raises(IndexError):
        advance_index(SEQ, 4, delta=1)


def test_frame2_needs_fallback_then_scores():
    fr = get_frame(SEQ, 2)
    assert missing_allowlist_fields(fr["snapshot"])
    with pytest.raises(PreSnapAdapterError) as exc:
        prepare_snapshot_for_score(fr, user_fallback=None)
    assert "allowlist" in str(exc.value).lower() or "unsupported-state" in str(exc.value)
    raw = prepare_snapshot_for_score(fr, user_fallback=fr["suggested_user_fallback"])
    assert "user_fallback" in raw


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_api_walkthrough_success_then_reject(client: TestClient):
    r = client.get(f"/situation-lab/api/recorded-demo/{SEQ}")
    assert r.status_code == 200
    assert r.json()["live_feed"] is False

    r0 = client.get(f"/situation-lab/api/recorded-demo/{SEQ}/frame/0")
    assert r0.status_code == 200, r0.text
    d0 = r0.json()
    assert d0["live_feed"] is False
    assert d0["truth_labels"]["play"] == "recorded_demo"
    assert d0["demo"]["frame_index"] == 0
    assert "layman_why" in d0 and len(d0["layman_why"]) > 10
    rec0 = d0["configs"]["pooled_improved"]["recommendation"]

    r1 = client.get(f"/situation-lab/api/recorded-demo/{SEQ}/frame/1")
    assert r1.status_code == 200, r1.text
    d1 = r1.json()
    assert d1["source"]["snapshot_id"] == "demo-lac-den-f1"
    assert d1["recommendation_changed_legacy_to_improved"] is False  # was True only via a phantom 81-yd FG (yardline 64 + 17); FG now out of range
    assert d1["configs"]["pooled_legacy"]["recommendation"] in ("punt", "inconclusive")  # H6: near tie
    assert d1["configs"]["pooled_improved"]["recommendation"] in ("punt", "inconclusive")  # H6: near tie
    # Score/clock changed vs frame 0
    assert d1["play"]["game_state"]["score_differential"] != d0["play"]["game_state"][
        "score_differential"
    ]

    # Frame 2 without fallback → 400 (no silent prior reuse in response)
    r2 = client.get(f"/situation-lab/api/recorded-demo/{SEQ}/frame/2")
    assert r2.status_code == 400
    assert "allowlist" in r2.json()["detail"].lower() or "unsupported" in r2.json()[
        "detail"
    ].lower()
    assert "configs" not in r2.json()

    r2ok = client.post(
        f"/situation-lab/api/recorded-demo/{SEQ}/frame/2",
        json={"apply_suggested_fallback": True},
    )
    assert r2ok.status_code == 200, r2ok.text
    assert r2ok.json()["field_sources"]["distance"] == "user_fallback"
    assert r2ok.json()["configs"]["pooled_improved"]["recommendation"] in ("punt", "inconclusive")  # H6: near tie

    # Stale reject
    r3 = client.get(f"/situation-lab/api/recorded-demo/{SEQ}/frame/3")
    assert r3.status_code == 400
    assert "stale" in r3.json()["detail"].lower()
    assert "configs" not in r3.json()
    # Prior success payload is not embedded in error
    assert r3.json().get("recommendation_changed_legacy_to_improved") is None

    # Inconsistent score reject
    r4 = client.get(f"/situation-lab/api/recorded-demo/{SEQ}/frame/4")
    assert r4.status_code == 400
    assert "score_differential" in r4.json()["detail"].lower()

    # Sanity: frame 0 still independently scoreable after rejects
    r0b = client.get(f"/situation-lab/api/recorded-demo/{SEQ}/frame/0")
    assert r0b.status_code == 200
    assert r0b.json()["configs"]["pooled_improved"]["recommendation"] == rec0


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_historical_path_still_selectable(client: TestClient):
    r = client.get(
        "/situation-lab/api/compare",
        params={"season": 2022, "game_id": "2022_18_LAC_DEN", "play_id": 3897},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["truth_labels"]["play"] == "historical"
    assert data["recommendation_changed_legacy_to_improved"] is False  # was True only via a phantom 81-yd FG (yardline 64 + 17); FG now out of range
    assert "layman_why" in data


def test_html_has_demo_mode_and_why(client: TestClient):
    r = client.get("/situation-lab")
    assert r.status_code == 200
    body = r.text
    assert "Recorded demo" in body
    assert "recorded-demo" in body
    assert "layman-why" in body
    assert "not a live feed" in body.lower() or "never a live feed" in body.lower()


def test_layman_why_from_existing_fields_only():
    why = layman_why_from_config(
        {
            "recommendation": "punt",
            "inconclusive": False,
            "margin": 0.02,
            "values": {"go": 0.40, "fg": 0.41, "punt": 0.45},
        }
    )
    assert "punt" in why.lower() or "Punting" in why
    why_i = layman_why_from_config(
        {"recommendation": "inconclusive", "inconclusive": True, "margin": 0.001, "values": {}}
    )
    assert "close" in why_i.lower()
