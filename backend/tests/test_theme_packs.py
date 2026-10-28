"""B6 themed packs: builder helpers and the committed pack files (no lake needed)."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pandas as pd

REPO = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("btp", REPO / "backend" / "scripts" / "build_theme_packs.py")
btp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(btp)


def test_select_keeps_existing_ids_and_fills_by_hash():
    cands = {f"g-{i}": i for i in range(10)}
    make = lambda iid: {"id": iid}  # noqa: E731
    first, _ = btp.select([], cands, make, 4)
    again, dropped = btp.select([i["id"] for i in first], cands, make, 4)
    assert [i["id"] for i in again] == [i["id"] for i in first] and dropped == []
    # an existing id that left the pool is dropped (and reported); its slot is refilled
    gone = first[1]["id"]
    rest = {k: v for k, v in cands.items() if k != gone}
    third, dropped = btp.select([i["id"] for i in first], rest, make, 4)
    assert dropped == [gone]
    assert [i["id"] for i in third][:3] == [i["id"] for i in first if i["id"] != gone]
    assert len(third) == 4


def test_play_order_counts_snaps_in_drive():
    raw = pd.DataFrame({
        "game_id": ["G"] * 5, "fixed_drive": [1, 1, 1, 2, 2],
        "play_id": [1, 5, 9, 12, 15], "play_type": ["kickoff", None, "run", "pass", "punt"],
    })
    order = btp.compute_play_order(raw)
    assert order[("G", 1)] == 1 and order[("G", 9)] == 2 and order[("G", 12)] == 1 and order[("G", 15)] == 2
    assert order[("G", "drive", 1)] == 2 and btp.drive_fields(SimpleNamespace(game_id="G", fixed_drive=1.0, play_id=9.0), order)["drivePlays"] == 2
    r = SimpleNamespace(game_id="G", fixed_drive=2.0, play_id=15.0)
    assert btp.drive_fields(r, order) == {"driveId": "G-d2", "playOrder": 2, "drivePlays": 2}


def test_qualifies_rules():
    r = SimpleNamespace(yardline_100=4, season_type="REG", drive_play_count=12, fixed_drive=3.0)
    assert btp.qualifies("goal-line", r) and btp.qualifies("marathon", r) and not btp.qualifies("playoffs", r)


def test_slim_matches_daily_item_fields():
    daily = json.loads((REPO / "frontend" / "lib" / "dailyPack.json").read_text())["items"][0]
    full = json.loads(json.dumps(daily))
    full["situation"]["score_differential"] = 3
    full["reveal"]["layman_why"] = "x"
    assert btp.slim(full) == daily


def test_committed_packs_shape():
    daily_keys = set(json.loads((REPO / "frontend" / "lib" / "dailyPack.json").read_text())["items"][0])
    for theme in btp.THEMES:
        pack = json.loads((btp.PACK_DIR / f"{theme}.json").read_text())
        assert pack["schema_version"] == btp.SCHEMA and pack["theme"] == theme
        extra = {"driveId", "playOrder", "drivePlays"} if theme == "marathon" else set()
        for it in pack["items"]:
            assert set(it) == daily_keys | extra
            assert "epa" not in json.dumps(list(it)).lower() and "xpass" not in json.dumps(list(it)).lower()
