"""Shared frozen-data guard for the mining/build_*.py site builders (2026 PR1: no data changes).

Policy (HGIC-approved plan, nfl-handoff/2026-11-10/scope-2026-season.md):
  * Closed seasons (season <= FROZEN_THROUGH = 2025) are frozen for good. No builder may change, drop or
    insert a 2019-2025 value, whatever the season span or source string of the new build says. All-seasons
    totals ("all", gorates/outcomes/calib cells, summaries) stay the 2019-2025 numbers; an open season
    gets its own season key / slice instead.
  * Open season (2026): a per-file week watermark (mining/frozen_watermarks.json, {file: {season: week}})
    marks completed weeks frozen. Published rows never change; new rows may only be appended, and never
    into a season <= FROZEN_THROUGH or a week <= the file's watermark.
  * Only finished games are built (``is_finished_game``; the same rule as NFL Data & Models' games-v8).
  * Ranked / top lists may grow and reorder, but may never evict or change a published row.
  * Reviewed overrides (mining/frozen_overrides/*.json) are applied by each builder exactly as before; this
    module only adds checks, it never loosens one.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping

sys.path.insert(0, str(Path(__file__).resolve().parent))
from seasons import CLOSED_THROUGH  # noqa: E402

FROZEN_THROUGH = CLOSED_THROUGH  # the shared season list (mining/seasons.py)
WATERMARKS = Path(__file__).resolve().parent / "frozen_watermarks.json"
# columns read_pbp() needs to decide whether a game is finished (dropped again before the builder sees them)
FINISH_COLUMNS = ("game_id", "home_score", "desc", "qtr", "quarter_end", "total_home_score", "total_away_score",
                  "season_type")
_GID = re.compile(r"^(\d{4})_(\d{2})_")


# ---- finished games (shared with NFL Data & Models games-v8) -----------------------------------------------

def _n(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if f != f else f


def is_finished_game(rows: Iterable[Mapping[str, Any]]) -> bool:
    """One game's play-by-play rows (file order). Finished = the final score is present (home_score not
    null on every row) AND the play-by-play reaches the end of the game: an "END GAME" row, or the final
    quarter closed (quarter_end on Q4 with the score not tied, or on an overtime period that ends the game:
    not tied, or a regular-season tie). A game loaded half-way through the day is not finished."""
    rows = list(rows)
    if not rows or any(_n(r.get("home_score")) is None for r in rows):
        return False
    if any(str(r.get("desc") or "").strip().upper() == "END GAME" for r in rows):
        return True
    closed = [r for r in rows if _n(r.get("quarter_end")) == 1 and (_n(r.get("qtr")) or 0) >= 4]
    if not closed:
        return False
    last = max(closed, key=lambda r: _n(r.get("qtr")) or 0)
    if (_n(last.get("qtr")) or 0) < max(_n(r.get("qtr")) or 0 for r in rows):
        return False  # a later period has started
    tied = _n(last.get("total_home_score")) == _n(last.get("total_away_score"))
    if _n(last.get("qtr")) == 4:
        return not tied
    return not tied or last.get("season_type") != "POST"


def finished_game_ids(rows: Iterable[Mapping[str, Any]]) -> set[str]:
    by: dict[str, list[Mapping[str, Any]]] = {}
    for r in rows:
        by.setdefault(str(r.get("game_id")), []).append(r)
    return {g for g, rs in by.items() if is_finished_game(rs)}


def read_pbp(paths: Iterable[str], columns: Iterable[str]):
    """pd.concat of the pbp parquets (``columns`` only), keeping only finished games' rows."""
    import pandas as pd

    columns = list(columns)
    frames = []
    for p in paths:
        have = set(_parquet_columns(p))
        extra = [c for c in FINISH_COLUMNS if c in have and c not in columns]
        df = pd.read_parquet(p, columns=columns + extra)
        fin = finished_game_ids(df[[c for c in FINISH_COLUMNS if c in df.columns]].to_dict("records"))
        frames.append(df[df["game_id"].astype(str).isin(fin)][columns])
    return pd.concat(frames, ignore_index=True)


def _parquet_columns(path: str) -> list[str]:
    import pyarrow.parquet as pq

    return list(pq.read_schema(path).names)


# ---- seasons, weeks and watermarks ---------------------------------------------------------------------------

def season_week(gid: Any) -> tuple[int, int] | None:
    m = _GID.match(str(gid or ""))
    return (int(m.group(1)), int(m.group(2))) if m else None


def load_watermarks(path: Path | str = WATERMARKS) -> dict[str, dict[str, int]]:
    p = Path(path)
    return json.loads(p.read_text()).get("weeks", {}) if p.exists() else {}


def watermark(name: str | None, season: int, marks: Mapping[str, Mapping[str, int]] | None = None) -> int:
    marks = load_watermarks() if marks is None else marks
    return int((marks.get(name or "", {}) or {}).get(str(season), 0))


def is_frozen_season(season: Any) -> bool:
    return int(season) <= FROZEN_THROUGH


def is_frozen_game(gid: Any, name: str | None = None, marks: Mapping[str, Mapping[str, int]] | None = None) -> bool:
    """A game in a closed season, or in a completed (watermarked) week of the open season."""
    sw = season_week(gid)
    if sw is None:
        return True  # unknown id: treat as frozen (no silent insert)
    s, w = sw
    return is_frozen_season(s) or w <= watermark(name, s, marks)


def open_season_key(k: Any) -> bool:
    """A season key ("2026") that may be added to a per-season dict."""
    return isinstance(k, (str, int)) and re.fullmatch(r"\d{4}", str(k)) is not None and int(k) > FROZEN_THROUGH


# ---- comparisons ------------------------------------------------------------------------------------------------

def grow_only(old: Any, new: Any, path: str = "") -> list[str]:
    """Old values must survive unchanged. Dicts may only gain open-season keys ("2026"); every other value
    (lists, numbers, "all" totals) must be identical. Returns the paths that broke the rule."""
    if isinstance(old, dict) and isinstance(new, dict):
        bad = [f"{path}{k} removed" for k in old if k not in new]
        for k in old:
            if k in new:
                bad += grow_only(old[k], new[k], f"{path}{k}.")
        bad += [f"{path}{k} added" for k in new if k not in old and not open_season_key(k)]
        return bad
    return [] if old == new else [path.rstrip(".") or "value"]


def default_gid(r: Any) -> Any:
    return r.get("game_id", r.get("gameId")) if isinstance(r, Mapping) else None


def check_rows(old_rows: list, new_rows: list, key: Callable[[Any], Any], name: str | None = None,
               ranked: bool = False, gid: Callable[[Any], Any] = default_gid,
               marks: Mapping[str, Mapping[str, int]] | None = None, label: str = "") -> list[str]:
    """Rows that are new (key not published): never in a frozen game/week. Unranked lists are append-only:
    every published row comes before every new row, in the published order. (Changed/removed published rows
    are reported by the caller's value check.)"""
    old_keys = [key(r) for r in old_rows]
    seen = set(old_keys)
    marks = load_watermarks() if marks is None else marks
    bad = [f"{label}inserted into frozen week {key(r)}" for r in new_rows
           if key(r) not in seen and is_frozen_game(gid(r), name, marks)]
    if not ranked:
        order = [key(r) for r in new_rows]
        kept = [k for k in order if k in seen]
        first_new = next((i for i, k in enumerate(order) if k not in seen), len(order))
        if kept != [k for k in old_keys if k in set(order)] or any(k in seen for k in order[first_new:]):
            bad.append(f"{label}not append-only (a new row sits before a published row)")
    return bad


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any], key: Callable[[dict], tuple],
                 records: str = "plays", summary: tuple[str, ...] = (), name: str | None = None,
                 ranked: bool = False, marks: Mapping[str, Mapping[str, int]] | None = None) -> list[str]:
    """Every published record must survive unchanged; new records are appended only (unless ``ranked``) and
    never into a frozen season/week; summary fields are frozen (only open-season keys may be added),
    whatever the season list. Returns human-readable reasons (empty = OK)."""
    if not old:
        return []
    cols = old.get("cols")
    def rows(f):  # records may be dicts or arrays under "cols"
        return [dict(zip(f["cols"], r)) if cols else r for r in f.get(records, [])]
    oldrows, newrows_l = rows(old), rows(new)
    newrows = {key(r): r for r in newrows_l}
    keep = set(new.get("cols") or []) if cols else None  # a deliberately dropped column is not a value change
    proj = (lambda r: {k: v for k, v in r.items() if k in keep}) if cols else (lambda r: r)
    bad = [f"changed/removed {key(r)}" for r in oldrows if newrows.get(key(r)) != proj(r)]
    bad += check_rows(oldrows, newrows_l, key, name, ranked, marks=marks)
    for k in summary:
        bad += [f"summary {p}" for p in grow_only(old.get(k), new.get(k), f"{k}.")]
    if cols and not set(new.get("cols") or []) <= set(cols):
        bad.append("cols added")  # new columns need a deliberate rebuild
    return bad
