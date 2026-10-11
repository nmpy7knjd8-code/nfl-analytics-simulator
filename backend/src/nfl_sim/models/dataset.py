"""Load pinned raw seasons for EP modeling."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd

from nfl_sim.config import Settings, settings
from nfl_sim.models.labels import construct_next_score_labels, eligible_mask
from nfl_sim.models.split import (
    ALL_MODEL_SEASONS,
    assert_split_integrity,
    assign_split,
    forbid_test_season_in_fit,
)


CORE_COLUMNS: tuple[str, ...] = (
    "game_id",
    "play_id",
    "season",
    "season_type",
    "qtr",
    "down",
    "ydstogo",
    "yardline_100",
    "half_seconds_remaining",
    "posteam",
    "home_team",
)


def raw_season_path(season: int, cfg: Settings | None = None) -> Path:
    cfg = cfg or settings
    return cfg.raw_dir / "pbp" / f"season={season}" / "play_by_play.parquet"


def load_raw_seasons(
    seasons: list[int] | tuple[int, ...],
    *,
    cfg: Settings | None = None,
) -> pd.DataFrame:
    cfg = cfg or settings
    frames: list[pd.DataFrame] = []
    for season in seasons:
        path = raw_season_path(season, cfg)
        if not path.exists():
            raise FileNotFoundError(
                f"Missing raw season {season} at {path}. Run: "
                f"python -m nfl_sim.ingest --seasons {','.join(str(s) for s in seasons)}"
            )
        frames.append(pd.read_parquet(path))
    out = pd.concat(frames, ignore_index=True)
    missing_core = [c for c in CORE_COLUMNS if c not in out.columns]
    if missing_core:
        raise ValueError(f"PBP missing required columns: {missing_core}")
    return out


def data_hash_for_seasons(seasons: list[int] | tuple[int, ...], cfg: Settings | None = None) -> dict:
    """Manifest sha256s + combined hash for reproducibility metadata."""
    cfg = cfg or settings
    per: dict[str, str] = {}
    h = hashlib.sha256()
    for season in seasons:
        man = cfg.raw_dir / "pbp" / f"season={season}" / "manifest.json"
        if man.exists():
            meta = json.loads(man.read_text())
            digest = meta["file_sha256"]
        else:
            digest = hashlib.sha256(raw_season_path(season, cfg).read_bytes()).hexdigest()
        per[str(season)] = digest
        h.update(digest.encode())
    return {"combined_sha256": h.hexdigest(), "season_sha256": per}


def build_modeling_frame(
    seasons: list[int] | tuple[int, ...] = ALL_MODEL_SEASONS,
    *,
    cfg: Settings | None = None,
) -> pd.DataFrame:
    """Raw PBP → labeled eligible modeling rows with split column."""
    pbp = load_raw_seasons(seasons, cfg=cfg)
    labels = construct_next_score_labels(pbp)
    mask = eligible_mask(pbp, labels)
    frame = pbp.loc[mask].copy()
    frame["ep_label"] = labels.loc[mask].astype("string")
    frame["split"] = assign_split(frame["season"])
    frame = frame[frame["split"].isin(["train", "val", "test"])].reset_index(drop=True)
    return frame


def split_frames(frame: pd.DataFrame) -> dict[str, pd.DataFrame]:
    train = frame[frame["split"] == "train"]
    val = frame[frame["split"] == "val"]
    test = frame[frame["split"] == "test"]
    forbid_test_season_in_fit(train["season"].unique(), context="train_fit")
    # Validate may only use 2022; still forbid 2023
    forbid_test_season_in_fit(val["season"].unique(), context="val_select")
    assert_split_integrity(train["season"].unique(), purpose="train")
    assert_split_integrity(val["season"].unique(), purpose="val", allow_empty=True)
    assert_split_integrity(test["season"].unique(), purpose="test", allow_empty=True)
    return {"train": train, "val": val, "test": test}
