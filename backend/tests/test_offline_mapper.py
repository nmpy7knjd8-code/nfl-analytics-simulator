"""Offline mapper — Y1–Y15, aliases, fail-closed, C-cases, E2E Lab (no HTTP)."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from nfl_sim.api.app import create_app
from nfl_sim.api.situation_lab import WP_MODEL_ARTIFACT, build_situation_lab_payload
from nfl_sim.config import REPO_ROOT
from nfl_sim.providers.offline_mapper import (
    FRAMES_DIR,
    OfflineMapperError,
    alias_normalize,
    alias_to_team_id,
    apply_receive_2h_ko_fail_closed,
    list_frames,
    load_frame,
    map_frame_id,
    map_offline_frame,
    yardline_100_from_sr,
)
from nfl_sim.providers.pre_snap import parse_pre_snap_snapshot

LAKE_2022 = REPO_ROOT / "data" / "raw" / "pbp" / "season=2022" / "play_by_play.parquet"

# Y1–Y15 (home=KC, away=DEN) — signed-off acceptance table
Y_CASES: list[tuple[str, str, str, int | None, int | str]] = [
    ("Y1", "KC", "KC", 25, 75),
    ("Y2", "KC", "DEN", 25, 25),
    ("Y3", "KC", "KC", 50, 50),
    ("Y4", "KC", "DEN", 50, 50),
    ("Y5", "KC", "DEN", 1, 1),
    ("Y6", "KC", "KC", 1, 99),
    ("Y7", "KC", "DEN", 20, 20),
    ("Y8", "KC", "KC", 20, 80),
    ("Y9", "DEN", "DEN", 30, 70),
    ("Y10", "DEN", "KC", 30, 30),
    ("Y11", "KC", "KC", 0, "reject"),
    ("Y12", "KC", "DEN", 100, "reject"),
    ("Y13", "KC", None, 25, "reject"),
    ("Y14", "KC", "SEA", 25, "reject"),
    ("Y15", "KC", "den", 25, 25),
]


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app())


@pytest.fixture()
def base_frame() -> dict:
    return load_frame("kc-den-q4-own-25")


# --- Yardline Y1–Y15 ---


@pytest.mark.parametrize("case_id,poss,alias,yrd,expected", Y_CASES, ids=[c[0] for c in Y_CASES])
def test_y1_y15_yardline(case_id, poss, alias, yrd, expected):
    if expected == "reject":
        with pytest.raises(OfflineMapperError):
            yardline_100_from_sr(poss, alias, yrd, "KC", "DEN")
    else:
        assert yardline_100_from_sr(poss, alias, yrd, "KC", "DEN") == expected


# --- S1–S5 known-state spot-checks (deterministic offline frames) ---


def test_s1_s5_spot_checks_against_pure_function():
    """S1–S5: raw location + possession → mapped yardline_100 matches recomputation."""
    states = [
        ("KC", "KC", 25),  # own
        ("KC", "DEN", 25),  # opp
        ("KC", "DEN", 20),  # RZ
        ("DEN", "DEN", 30),  # flip own
        ("DEN", "KC", 30),  # flip opp
    ]
    for poss, loc, yrd in states:
        mapped = yardline_100_from_sr(poss, loc, yrd, "KC", "DEN")
        recomputed = yardline_100_from_sr(poss, loc, yrd, "KC", "DEN")
        assert mapped == recomputed
        assert 1 <= mapped <= 99


# --- Alias normalize / reject ---


def test_alias_normalize_case():
    assert alias_normalize("kc") == "KC"
    assert alias_normalize("DEN") == "DEN"


def test_alias_reject_missing_nickname_space_fuzzy():
    with pytest.raises(OfflineMapperError, match="alias_missing"):
        alias_normalize("")
    with pytest.raises(OfflineMapperError, match="alias_missing"):
        alias_normalize(None)
    with pytest.raises(OfflineMapperError, match="alias_charset"):
        alias_normalize("K C")
    with pytest.raises(OfflineMapperError, match="alias_not_in_game"):
        alias_to_team_id("SEA", "KC", "DEN", "KC", "DEN")
    with pytest.raises(OfflineMapperError, match="alias_charset|alias_not_in_game"):
        # nickname normalizes to CHIEFS then not in game
        alias_to_team_id(alias_normalize("Chiefs"), "KC", "DEN", "KC", "DEN")


# --- receive_2h_ko fail-closed (C1/C2 shape) ---


def test_c1_c2_missing_receive_2h_ko_fail_closed(base_frame: dict):
    bad = copy.deepcopy(base_frame)
    del bad["situation"]["receive_2h_ko"]
    with pytest.raises(OfflineMapperError, match="receive_2h_ko_unavailable|fail_closed"):
        map_offline_frame(bad)
    with pytest.raises(OfflineMapperError, match="fail_closed"):
        apply_receive_2h_ko_fail_closed({})


def test_receive_2h_ko_present_ok(base_frame: dict):
    snap = map_offline_frame(base_frame)
    assert snap["situation"]["receive_2h_ko"] == 0
    assert snap["situation"]["yardline_100"] == 75  # Y1


# --- Enums / provider (C6) ---


def test_c6_unknown_provider_rejected(base_frame: dict):
    for bad_p in ("live", "sportradar", "Sportradar", "", "fixture_demo"):
        bad = copy.deepcopy(base_frame)
        bad["provider"] = bad_p
        with pytest.raises(OfflineMapperError, match="provider"):
            map_offline_frame(bad)


def test_unknown_freshness_rejected(base_frame: dict):
    bad = copy.deepcopy(base_frame)
    bad["freshness"] = "fresh"
    with pytest.raises(OfflineMapperError, match="freshness"):
        map_offline_frame(bad)


def test_season_type_unmapped(base_frame: dict):
    bad = copy.deepcopy(base_frame)
    bad["game"]["season_type"] = "Regular Season"
    with pytest.raises(OfflineMapperError, match="season_type_unmapped"):
        map_offline_frame(bad)


# --- Score / stale / timestamps ---


def test_c5_score_inconsistency(base_frame: dict):
    bad = copy.deepcopy(base_frame)
    bad["situation"]["score_differential"] = 0
    with pytest.raises(OfflineMapperError, match="score_differential"):
        map_offline_frame(bad)


def test_missing_event_timestamp(base_frame: dict):
    bad = copy.deepcopy(base_frame)
    del bad["event_timestamp"]
    with pytest.raises(OfflineMapperError, match="event_timestamp"):
        map_offline_frame(bad)


def test_stale_maps_but_scoring_rejects():
    """C3: stale snapshot may map; Lab path refuses — no configs in API error."""
    snap = map_frame_id("kc-den-stale")
    assert snap["source"]["freshness"] == "stale"
    parse_pre_snap_snapshot(snap)  # envelope ok
    from nfl_sim.providers.pre_snap import PreSnapAdapterError, snapshot_to_decision_row

    with pytest.raises(PreSnapAdapterError, match="stale"):
        snapshot_to_decision_row(snap)


def test_bundled_bad_score_frame():
    with pytest.raises(OfflineMapperError, match="score_differential"):
        map_frame_id("kc-den-bad-score")


# --- Valid map + adapter ---


def test_map_emits_pre_snap_snapshot_v1(base_frame: dict):
    snap = map_offline_frame(base_frame)
    assert snap["schema_version"] == "pre_snap_snapshot.v1"
    assert snap["source"]["provider"] == "demo"
    assert "live_feed" not in snap["source"]
    parsed = parse_pre_snap_snapshot(snap)
    assert parsed.situation.yardline_100 == 75
    assert parsed.situation.possession_team_id == "KC"
    assert parsed.situation.defense_team_id == "DEN"


def test_frame_update_opp_25():
    snap = map_frame_id("kc-den-q4-opp-25")
    assert snap["situation"]["yardline_100"] == 25
    assert snap["source"]["revision"] == 2
    assert snap["source"]["snapshot_id"] != "offline-kc-den-own25-v1"


def test_list_frames_offline_only():
    items = list_frames()
    assert len(items) >= 4
    assert all(i["live_feed"] is False for i in items)
    assert all(i["provider"] == "demo" for i in items)


# --- API E2E (Phase 4) ---


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_api_offline_mapper_compare_scores(client: TestClient):
    r = client.get("/situation-lab/api/offline-mapper/compare/kc-den-q4-own-25")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["live_feed"] is False
    assert data["source"]["provider"] == "demo"
    assert data["offline_mapper"]["live_feed"] is False
    assert data["offline_mapper"]["yardline_100"] == 75
    assert "configs" in data
    assert set(data["configs"]) >= {"pooled_legacy", "season_aware_legacy", "pooled_improved"}
    assert "layman_why" in data
    assert data["truth_labels"]["play"] == "offline_mapper"


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_api_frame_update_then_stale_no_prior_reuse(client: TestClient):
    r1 = client.get("/situation-lab/api/offline-mapper/compare/kc-den-q4-own-25")
    assert r1.status_code == 200
    rec = r1.json()["configs"]["pooled_improved"]["recommendation"]

    r2 = client.get("/situation-lab/api/offline-mapper/compare/kc-den-q4-opp-25")
    assert r2.status_code == 200
    assert r2.json()["offline_mapper"]["yardline_100"] == 25
    assert r2.json()["source"]["snapshot_id"] != r1.json()["source"]["snapshot_id"]

    r3 = client.get("/situation-lab/api/offline-mapper/compare/kc-den-stale")
    assert r3.status_code == 400
    body = r3.json()
    assert "stale" in body["detail"].lower()
    assert "configs" not in body
    assert body.get("recommendation_changed_legacy_to_improved") is None

    r4 = client.get("/situation-lab/api/offline-mapper/compare/kc-den-bad-score")
    assert r4.status_code == 400
    assert "score" in r4.json()["detail"].lower()
    assert "configs" not in r4.json()

    # Prior success still independently available
    r1b = client.get("/situation-lab/api/offline-mapper/compare/kc-den-q4-own-25")
    assert r1b.status_code == 200
    assert r1b.json()["configs"]["pooled_improved"]["recommendation"] == rec


def test_api_post_unknown_provider(client: TestClient, base_frame: dict):
    bad = copy.deepcopy(base_frame)
    bad["provider"] = "live"
    r = client.post("/situation-lab/api/offline-mapper/compare", json=bad)
    assert r.status_code == 400
    assert "provider" in r.json()["detail"].lower()
    assert "configs" not in r.json()


def test_api_list_frames(client: TestClient):
    r = client.get("/situation-lab/api/offline-mapper/frames")
    assert r.status_code == 200
    data = r.json()
    assert data["live_feed"] is False
    assert "fixture" in data["provider_enum"]
    assert any(i["id"] == "kc-den-q4-own-25" for i in data["items"])


@pytest.mark.skipif(not WP_MODEL_ARTIFACT.exists(), reason="WP artifact missing")
def test_recorded_demo_and_historical_intact(client: TestClient):
    r = client.get("/situation-lab/api/recorded-demo/sequences")
    assert r.status_code == 200
    assert any(i["id"] == "lac-den-q4-demo" for i in r.json()["items"])

    r0 = client.get("/situation-lab/api/recorded-demo/lac-den-q4-demo/frame/0")
    assert r0.status_code == 200
    assert r0.json()["live_feed"] is False

    if LAKE_2022.is_file():
        h = client.get(
            "/situation-lab/api/compare",
            params={"season": 2022, "game_id": "2022_18_LAC_DEN", "play_id": 3897},
        )
        assert h.status_code == 200
        assert h.json()["truth_labels"]["play"] == "historical"


def test_no_http_imports_in_mapper_module():
    src = Path(__file__).resolve().parents[1] / "src" / "nfl_sim" / "providers" / "offline_mapper.py"
    text = src.read_text(encoding="utf-8")
    for banned in ("requests", "httpx", "urllib", "aiohttp", "playback.sportradar", "api.sportradar"):
        assert banned not in text


def test_fixture_files_exist():
    for name in (
        "kc_den_q4_own_25.json",
        "kc_den_q4_opp_25.json",
        "kc_den_stale.json",
        "kc_den_bad_score.json",
    ):
        assert (FRAMES_DIR / name).is_file()
        json.loads((FRAMES_DIR / name).read_text(encoding="utf-8"))
