"""Historical fourth-down decision lab: freeze a lake row → reuse FourthDownAnalyzer.

Read-only / offline. Does not duplicate go/FG/punt scoring logic.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from nfl_sim.ingest.derive import derive_receive_2h_ko
from nfl_sim.models.dataset import load_raw_seasons
from nfl_sim.models.fourth_down import (
    FourthDownAnalyzer,
    FourthDownResult,
    FourthDownSituation,
    sensitivity_example,
)
from nfl_sim.models.fourth_down_empirics import EmpiricsMode, FG_SNAP_YARDS, TransitionMode

# Provenance + state columns surfaced to the lab (when present in PBP).
PROVENANCE_COLUMNS: tuple[str, ...] = (
    "season",
    "season_type",
    "week",
    "game_id",
    "play_id",
    "posteam",
    "defteam",
    "home_team",
    "away_team",
    "play_type",
    "desc",
    "fourth_down_converted",
    "field_goal_result",
    "kick_distance",
    "punt_blocked",
    "yards_gained",
)

STATE_COLUMNS: tuple[str, ...] = (
    "down",
    "ydstogo",
    "yardline_100",
    "score_differential",
    "game_seconds_remaining",
    "half_seconds_remaining",
    "qtr",
    "posteam_timeouts_remaining",
    "defteam_timeouts_remaining",
)


@dataclass
class HistoricalFourthDown:
    """One lake 4th-down row frozen for offline analysis."""

    provenance: dict[str, Any]
    situation: FourthDownSituation
    game_state: dict[str, Any]
    historical_action: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "provenance": self.provenance,
            "situation": asdict(self.situation),
            "game_state": self.game_state,
            "historical_action": self.historical_action,
            "truth": "historical",
        }


@dataclass
class DecisionLabResult:
    """End-to-end lab output: frozen play + three action values + sensitivity."""

    play: HistoricalFourthDown
    analysis: FourthDownResult
    sensitivity: dict[str, Any] | None = None
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "play": self.play.to_dict(),
            "analysis": self.analysis.to_dict(),
            "sensitivity": self.sensitivity,
            "notes": self.notes,
            "truth_labels": {
                "play": "historical",
                "action_values": "model_counterfactual",
                "recommendation": "model_counterfactual",
            },
        }


def _scalar(value: Any) -> Any:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    if hasattr(value, "item"):
        try:
            return value.item()
        except (ValueError, AttributeError):
            pass
    if pd.isna(value):
        return None
    return value


def historical_action_from_play_type(play_type: Any) -> str | None:
    """Map nflverse play_type to go / fg / punt (or None if unknown)."""
    if play_type is None or (isinstance(play_type, float) and np.isnan(play_type)):
        return None
    pt = str(play_type).strip().lower()
    if pt in {"pass", "run", "qb_kneel", "qb_spike"}:
        return "go"
    if pt in {"field_goal"}:
        return "fg"
    if pt in {"punt"}:
        return "punt"
    return None


def fourth_down_mask(df: pd.DataFrame) -> pd.Series:
    """Rows that are valid pre-snap 4th downs for the lab."""
    down = pd.to_numeric(df["down"], errors="coerce")
    dist = pd.to_numeric(df["ydstogo"], errors="coerce")
    yl = pd.to_numeric(df["yardline_100"], errors="coerce")
    gsec = pd.to_numeric(df["game_seconds_remaining"], errors="coerce")
    hsec = pd.to_numeric(df["half_seconds_remaining"], errors="coerce")
    sd = pd.to_numeric(df["score_differential"], errors="coerce")
    return (
        down.eq(4)
        & dist.ge(1)
        & dist.le(99)
        & yl.ge(1)
        & yl.le(99)
        & gsec.notna()
        & hsec.notna()
        & sd.notna()
        & df["posteam"].notna()
        & df["home_team"].notna()
    )


def load_fourth_down_frame(
    seasons: list[int] | tuple[int, ...],
    *,
    season_type: str | None = "REG",
) -> pd.DataFrame:
    """Load lake seasons and return valid 4th-down rows (sorted by game/play)."""
    df = load_raw_seasons(seasons)
    if "receive_2h_ko" not in df.columns:
        # Derive on full games so first-half receiver is correct, then filter.
        df = df.copy()
        df["receive_2h_ko"] = derive_receive_2h_ko(df)
    mask = fourth_down_mask(df)
    if season_type is not None and "season_type" in df.columns:
        mask = mask & df["season_type"].astype("string").eq(season_type)
    out = df.loc[mask].copy()
    return out.sort_values(["season", "game_id", "play_id"], kind="mergesort").reset_index(drop=True)


def extract_provenance(row: pd.Series | dict[str, Any]) -> dict[str, Any]:
    data = row if isinstance(row, dict) else row.to_dict()
    prov: dict[str, Any] = {}
    for col in PROVENANCE_COLUMNS:
        if col in data:
            prov[col] = _scalar(data[col])
    return prov


def row_to_situation(row: pd.Series | dict[str, Any]) -> FourthDownSituation:
    """Map a lake 4th-down row to FourthDownSituation (possession-team view)."""
    data = row if isinstance(row, dict) else row.to_dict()
    posteam = str(data["posteam"])
    home = str(data["home_team"])
    is_home = posteam == home

    r2h_raw = _scalar(data.get("receive_2h_ko"))
    if r2h_raw is not None:
        r2h = int(float(r2h_raw))
    else:
        # Single-row fallback: outside first half → 0; else derive (may be incomplete).
        qtr = int(float(data.get("qtr", 4) or 4))
        if qtr > 2:
            r2h = 0
        else:
            frame = pd.DataFrame([data])
            derived = derive_receive_2h_ko(frame).iloc[0]
            r2h = 0 if pd.isna(derived) else int(derived)

    pot = data.get("posteam_timeouts_remaining", data.get("posteam_timeouts", 2))
    dot = data.get("defteam_timeouts_remaining", data.get("defteam_timeouts", 2))

    return FourthDownSituation(
        yardline_100=int(float(data["yardline_100"])),
        distance=int(float(data["ydstogo"])),
        score_differential=int(float(data["score_differential"])),
        game_seconds_remaining=int(float(data["game_seconds_remaining"])),
        half_seconds_remaining=int(float(data["half_seconds_remaining"])),
        qtr=int(float(data.get("qtr", 4))),
        posteam_timeouts=int(float(pot if _scalar(pot) is not None else 2)),
        defteam_timeouts=int(float(dot if _scalar(dot) is not None else 2)),
        is_home_possession=bool(is_home),
        receive_2h_ko=r2h,
        season=int(float(data.get("season", 2022))),
    )


def freeze_play(row: pd.Series | dict[str, Any]) -> HistoricalFourthDown:
    """Freeze provenance + game state from one lake row."""
    data = row if isinstance(row, dict) else row.to_dict()
    sit = row_to_situation(data)
    game_state = {
        "score_differential": sit.score_differential,
        "game_seconds_remaining": sit.game_seconds_remaining,
        "half_seconds_remaining": sit.half_seconds_remaining,
        "qtr": sit.qtr,
        "yardline_100": sit.yardline_100,
        "distance": sit.distance,
        "down": 4,
        "posteam_timeouts": sit.posteam_timeouts,
        "defteam_timeouts": sit.defteam_timeouts,
        "is_home_possession": sit.is_home_possession,
        "kick_distance_if_fg": sit.yardline_100 + FG_SNAP_YARDS,
    }
    for col in STATE_COLUMNS:
        if col in data:
            game_state[f"lake_{col}"] = _scalar(data[col])
    hist = historical_action_from_play_type(data.get("play_type"))
    return HistoricalFourthDown(
        provenance=extract_provenance(data),
        situation=sit,
        game_state=game_state,
        historical_action=hist,
    )


def select_play(
    frame: pd.DataFrame,
    *,
    game_id: str | None = None,
    play_id: int | float | None = None,
    index: int | None = None,
) -> pd.Series:
    """Select one 4th-down row by game_id+play_id, or by positional index."""
    if frame.empty:
        raise ValueError("No fourth-down plays in frame")
    if game_id is not None:
        if play_id is None:
            raise ValueError("play_id is required when game_id is set")
        gid = str(game_id)
        pid = float(play_id)
        ids = frame["game_id"].astype("string")
        pids = pd.to_numeric(frame["play_id"], errors="coerce")
        hit = frame.loc[ids.eq(gid) & pids.eq(pid)]
        if hit.empty:
            raise KeyError(f"No fourth-down play game_id={game_id!r} play_id={play_id}")
        return hit.iloc[0]
    idx = 0 if index is None else int(index)
    if idx < 0 or idx >= len(frame):
        raise IndexError(f"index {idx} out of range for {len(frame)} fourth-down plays")
    return frame.iloc[idx]


def run_decision_lab(
    analyzer: FourthDownAnalyzer,
    row: pd.Series | dict[str, Any],
    *,
    convert_delta: float = -0.10,
    make_delta: float = 0.0,
    include_sensitivity: bool = True,
    empirics_mode: EmpiricsMode = "pooled",
    transition_mode: TransitionMode = "legacy",
) -> DecisionLabResult:
    """Select path: freeze lake row → FourthDownAnalyzer.analyze (+ optional sensitivity)."""
    play = freeze_play(row)
    analysis = analyzer.analyze(
        play.situation, empirics_mode=empirics_mode, transition_mode=transition_mode
    )
    sens = None
    if include_sensitivity:
        sens = sensitivity_example(
            analyzer,
            play.situation,
            convert_delta=convert_delta,
            make_delta=make_delta,
            empirics_mode=empirics_mode,
            transition_mode=transition_mode,
        )
    resolve = (analysis.empirics_meta or {}).get("empirics_resolve") or {}
    notes = [
        "Action values reuse FourthDownAnalyzer (Path A WP + train empirics); not reimplemented here.",
        "Historical play_type is observation only; recommendation is model counterfactual.",
        "Offline / read-only: no live feeds, odds, or betting.",
        (
            f"Empirics seasons={analysis.empirics_meta.get('seasons')}; "
            f"n_go={analysis.empirics_meta.get('n_go')}, "
            f"n_fg={analysis.empirics_meta.get('n_fg')}, "
            f"n_punt={analysis.empirics_meta.get('n_punt')} (never 2023+)."
        ),
        f"Empirics mode={empirics_mode}; resolve={resolve.get('note')}",
        f"Transition mode={transition_mode}",
    ]
    if play.historical_action and play.historical_action != analysis.recommendation:
        notes.append(
            f"Historical action was {play.historical_action!r}; "
            f"model recommendation is {analysis.recommendation!r}."
        )
    return DecisionLabResult(play=play, analysis=analysis, sensitivity=sens, notes=notes)


def compare_empirics_modes(
    analyzer: FourthDownAnalyzer,
    row: pd.Series | dict[str, Any],
    *,
    convert_delta: float = -0.10,
    make_delta: float = 0.0,
    transition_mode: TransitionMode = "legacy",
) -> dict[str, Any]:
    """Same frozen lake play under pooled vs season_aware empirics (measure recommendation delta)."""
    pooled = run_decision_lab(
        analyzer,
        row,
        convert_delta=convert_delta,
        make_delta=make_delta,
        include_sensitivity=True,
        empirics_mode="pooled",
        transition_mode=transition_mode,
    )
    season_aware = run_decision_lab(
        analyzer,
        row,
        convert_delta=convert_delta,
        make_delta=make_delta,
        include_sensitivity=True,
        empirics_mode="season_aware",
        transition_mode=transition_mode,
    )
    sp = summarize_lab(pooled)
    ss = summarize_lab(season_aware)
    return {
        "play": pooled.play.to_dict(),
        "pooled": {"summary": sp, "analysis": pooled.analysis.to_dict(), "notes": pooled.notes},
        "season_aware": {
            "summary": ss,
            "analysis": season_aware.analysis.to_dict(),
            "notes": season_aware.notes,
        },
        "recommendation_changed": sp["recommendation"] != ss["recommendation"],
        "value_deltas": {
            k: float(ss["values"][k] - sp["values"][k])
            for k in ("go", "fg", "punt")
            if k in ss["values"] and k in sp["values"]
        },
    }


def compare_transition_modes(
    analyzer: FourthDownAnalyzer,
    row: pd.Series | dict[str, Any],
    *,
    convert_delta: float = -0.10,
    make_delta: float = 0.0,
    empirics_mode: EmpiricsMode = "pooled",
) -> dict[str, Any]:
    """Same freeze: legacy (mean punt + toy clock) vs improved (punt buckets + outcome clock)."""
    legacy = run_decision_lab(
        analyzer,
        row,
        convert_delta=convert_delta,
        make_delta=make_delta,
        include_sensitivity=False,
        empirics_mode=empirics_mode,
        transition_mode="legacy",
    )
    improved = run_decision_lab(
        analyzer,
        row,
        convert_delta=convert_delta,
        make_delta=make_delta,
        include_sensitivity=False,
        empirics_mode=empirics_mode,
        transition_mode="improved",
    )
    # Also season_aware + legacy for three-way harness view
    season_aware = run_decision_lab(
        analyzer,
        row,
        convert_delta=convert_delta,
        make_delta=make_delta,
        include_sensitivity=False,
        empirics_mode="season_aware",
        transition_mode="legacy",
    )
    sl = summarize_lab(legacy)
    si = summarize_lab(improved)
    ss = summarize_lab(season_aware)
    return {
        "play": legacy.play.to_dict(),
        "pooled_legacy": {"summary": sl, "analysis": legacy.analysis.to_dict()},
        "season_aware_legacy": {"summary": ss, "analysis": season_aware.analysis.to_dict()},
        "pooled_improved": {"summary": si, "analysis": improved.analysis.to_dict()},
        "recommendation_changed_legacy_to_improved": sl["recommendation"] != si["recommendation"],
        "value_deltas_legacy_to_improved": {
            k: float(si["values"][k] - sl["values"][k])
            for k in ("go", "fg", "punt")
            if k in si["values"] and k in sl["values"]
        },
        "clock_deltas_improved": (improved.analysis.empirics_meta or {}).get("clock_deltas_used"),
    }


def load_analyzer(
    model_path: Path,
    *,
    empirics_seasons: tuple[int, ...] | None = None,
) -> FourthDownAnalyzer:
    """Load WP artifact and fit train empirics (default TRAIN_SEASONS via analyzer)."""
    from nfl_sim.models.fourth_down_empirics import FourthDownEmpirics

    if not Path(model_path).exists():
        raise FileNotFoundError(
            f"Missing WP artifact: {model_path}. Train Path A WP first "
            "(uncalibrated primary; do not persist isotonic as default)."
        )
    if empirics_seasons is not None:
        emp = FourthDownEmpirics.fit_from_seasons(empirics_seasons)
        return FourthDownAnalyzer.load(Path(model_path), empirics=emp)
    return FourthDownAnalyzer.load(Path(model_path))


def summarize_lab(result: DecisionLabResult) -> dict[str, Any]:
    """Compact summary for CLI / status docs."""
    a = result.analysis
    p = result.play
    return {
        "game_id": p.provenance.get("game_id"),
        "play_id": p.provenance.get("play_id"),
        "season": p.provenance.get("season"),
        "yardline_100": p.situation.yardline_100,
        "distance": p.situation.distance,
        "score_differential": p.situation.score_differential,
        "game_seconds_remaining": p.situation.game_seconds_remaining,
        "historical_action": p.historical_action,
        "recommendation": a.recommendation,
        "inconclusive": a.inconclusive,
        "margin": a.margin,
        "values": {k: v.value_wp for k, v in a.actions.items()},
        "sensitivity_changed": (
            None
            if result.sensitivity is None
            else result.sensitivity.get("recommendation_changed")
        ),
        "empirics_seasons": a.empirics_meta.get("seasons"),
        "empirics_n": {
            "n_go": a.empirics_meta.get("n_go"),
            "n_fg": a.empirics_meta.get("n_fg"),
            "n_punt": a.empirics_meta.get("n_punt"),
        },
        "empirics_mode": a.empirics_meta.get("empirics_mode"),
        "empirics_resolve": a.empirics_meta.get("empirics_resolve"),
        "transition_mode": a.empirics_meta.get("transition_mode"),
        "clock_deltas_used": a.empirics_meta.get("clock_deltas_used"),
        "p_convert": a.actions["go"].components.get("p_convert"),
        "p_make": a.actions["fg"].components.get("p_make") if "fg" in a.actions else 0.0,
        "fg_in_range": "fg" in a.actions,
    }
