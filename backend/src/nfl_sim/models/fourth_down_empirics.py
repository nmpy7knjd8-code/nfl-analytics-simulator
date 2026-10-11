"""Empirical transition tables for offline 4th-down analysis (train seasons only)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

import numpy as np
import pandas as pd

from nfl_sim.models.constants import TRAIN_SEASONS
from nfl_sim.models.dataset import load_raw_seasons
from nfl_sim.models.split import forbid_test_season_in_fit

EmpiricsMode = Literal["pooled", "season_aware"]

# Distance bins for conversion (inclusive)
CONVERT_BINS: tuple[tuple[int, int], ...] = (
    (1, 1),
    (2, 2),
    (3, 3),
    (4, 5),
    (6, 10),
    (11, 99),
)

# Kick distance bins for FG
FG_BINS: tuple[tuple[int, int], ...] = (
    (18, 29),
    (30, 39),
    (40, 49),
    (50, 59),
    (60, 80),
)

# Pre-punt yardline_100 bins
PUNT_YARDLINE_BINS: tuple[tuple[int, int], ...] = (
    (1, 40),
    (41, 60),
    (61, 80),
    (81, 99),
)


def _bin_rate(bins: tuple[tuple[int, int], ...], x: float, table: dict[tuple[int, int], dict]) -> dict:
    for lo, hi in bins:
        if lo <= x <= hi:
            return table[(lo, hi)]
    # fallback nearest outer
    if x < bins[0][0]:
        return table[bins[0]]
    return table[bins[-1]]


def _build_convert_table(yd: pd.Series, conv: pd.Series) -> dict[tuple[int, int], dict[str, Any]]:
    convert_tbl: dict[tuple[int, int], dict[str, Any]] = {}
    for lo, hi in CONVERT_BINS:
        m = yd.ge(lo) & yd.le(hi) & conv.notna()
        n = int(m.sum())
        convert_tbl[(lo, hi)] = {
            "n": n,
            "p_convert": float(conv[m].mean()) if n else 0.4,
            "filter": "REG 4th pass/run with fourth_down_converted",
        }
    return convert_tbl


def _build_fg_table(kd: pd.Series, made: pd.Series) -> dict[tuple[int, int], dict[str, Any]]:
    fg_tbl: dict[tuple[int, int], dict[str, Any]] = {}
    for lo, hi in FG_BINS:
        m = kd.ge(lo) & kd.le(hi)
        n = int(m.sum())
        fg_tbl[(lo, hi)] = {
            "n": n,
            "p_make": float(made[m].mean()) if n else 0.5,
            "filter": "REG play_type=field_goal",
        }
    return fg_tbl


def _build_punt_table(yl: pd.Series, opp_yl: pd.Series) -> dict[tuple[int, int], dict[str, Any]]:
    punt_tbl: dict[tuple[int, int], dict[str, Any]] = {}
    for lo, hi in PUNT_YARDLINE_BINS:
        m = yl.ge(lo) & yl.le(hi) & opp_yl.notna()
        n = int(m.sum())
        punt_tbl[(lo, hi)] = {
            "n": n,
            "mean_opp_yardline_100": float(opp_yl[m].mean()) if n else 75.0,
            "filter": "REG punt, punt_blocked==0; TB→opp yardline_100=80",
        }
    return punt_tbl


def _ser_bins(d: dict[tuple[int, int], dict]) -> dict[str, dict]:
    return {f"{a}-{b}": v for (a, b), v in d.items()}


@dataclass
class FourthDownEmpirics:
    """Train-season empirical convert / FG / punt tables (pooled + per-season)."""

    convert_by_distance: dict[tuple[int, int], dict[str, Any]] = field(default_factory=dict)
    fg_by_kick_distance: dict[tuple[int, int], dict[str, Any]] = field(default_factory=dict)
    punt_by_yardline: dict[tuple[int, int], dict[str, Any]] = field(default_factory=dict)
    # Per-train-season mirrors of the pooled tables (never fit on 2023+).
    convert_by_season: dict[int, dict[tuple[int, int], dict[str, Any]]] = field(default_factory=dict)
    fg_by_season: dict[int, dict[tuple[int, int], dict[str, Any]]] = field(default_factory=dict)
    punt_by_season: dict[int, dict[tuple[int, int], dict[str, Any]]] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def fit_from_seasons(seasons: tuple[int, ...] = TRAIN_SEASONS) -> FourthDownEmpirics:
        forbid_test_season_in_fit(seasons, context="train_fit")
        if any(int(s) >= 2023 for s in seasons):
            raise ValueError("Refusing empirics fit on 2023+")
        df = load_raw_seasons(seasons)
        reg = df["season_type"].astype("string").eq("REG")

        # --- conversion on 4th-down go (pass/run) ---
        go = (
            reg
            & pd.to_numeric(df["down"], errors="coerce").eq(4)
            & df["play_type"].astype("string").str.lower().isin(["pass", "run"])
        )
        yd = pd.to_numeric(df.loc[go, "ydstogo"], errors="coerce")
        conv = pd.to_numeric(df.loc[go, "fourth_down_converted"], errors="coerce")
        convert_tbl = _build_convert_table(yd, conv)

        # --- FG make ---
        fg = reg & df["play_type"].astype("string").str.lower().eq("field_goal")
        kd = pd.to_numeric(df.loc[fg, "kick_distance"], errors="coerce")
        made = df.loc[fg, "field_goal_result"].astype("string").str.lower().eq("made")
        fg_tbl = _build_fg_table(kd, made)

        # --- punt resulting opp yardline ---
        pu = (
            reg
            & df["play_type"].astype("string").str.lower().eq("punt")
            & pd.to_numeric(df["punt_blocked"], errors="coerce").fillna(0).eq(0)
        )
        yl = pd.to_numeric(df.loc[pu, "yardline_100"], errors="coerce")
        kick = pd.to_numeric(df.loc[pu, "kick_distance"], errors="coerce")
        ret = pd.to_numeric(df.loc[pu, "return_yards"], errors="coerce").fillna(0.0)
        tb = pd.to_numeric(df.loc[pu, "touchback"], errors="coerce").fillna(0).eq(1)
        new_for_kicker = yl - kick + ret
        opp_yl = pd.Series(
            np.where(tb.to_numpy(), 80.0, np.clip(100.0 - new_for_kicker.to_numpy(), 1.0, 99.0)),
            index=yl.index,
        )
        punt_tbl = _build_punt_table(yl, opp_yl)

        # Per-season tables (same filters; train seasons only)
        season_col = pd.to_numeric(df["season"], errors="coerce")
        convert_by_season: dict[int, dict[tuple[int, int], dict[str, Any]]] = {}
        fg_by_season: dict[int, dict[tuple[int, int], dict[str, Any]]] = {}
        punt_by_season: dict[int, dict[tuple[int, int], dict[str, Any]]] = {}
        per_season_n: dict[str, dict[str, int]] = {}
        for s in seasons:
            s_i = int(s)
            s_mask = season_col.eq(s_i)
            go_s = go & s_mask
            convert_by_season[s_i] = _build_convert_table(
                pd.to_numeric(df.loc[go_s, "ydstogo"], errors="coerce"),
                pd.to_numeric(df.loc[go_s, "fourth_down_converted"], errors="coerce"),
            )
            fg_s = fg & s_mask
            fg_by_season[s_i] = _build_fg_table(
                pd.to_numeric(df.loc[fg_s, "kick_distance"], errors="coerce"),
                df.loc[fg_s, "field_goal_result"].astype("string").str.lower().eq("made"),
            )
            pu_s = pu & s_mask
            yl_s = pd.to_numeric(df.loc[pu_s, "yardline_100"], errors="coerce")
            kick_s = pd.to_numeric(df.loc[pu_s, "kick_distance"], errors="coerce")
            ret_s = pd.to_numeric(df.loc[pu_s, "return_yards"], errors="coerce").fillna(0.0)
            tb_s = pd.to_numeric(df.loc[pu_s, "touchback"], errors="coerce").fillna(0).eq(1)
            new_s = yl_s - kick_s + ret_s
            opp_s = pd.Series(
                np.where(tb_s.to_numpy(), 80.0, np.clip(100.0 - new_s.to_numpy(), 1.0, 99.0)),
                index=yl_s.index,
            )
            punt_by_season[s_i] = _build_punt_table(yl_s, opp_s)
            per_season_n[str(s_i)] = {
                "n_go": int(go_s.sum()),
                "n_fg": int(fg_s.sum()),
                "n_punt": int(pu_s.sum()),
            }

        out = FourthDownEmpirics(
            convert_by_distance=convert_tbl,
            fg_by_kick_distance=fg_tbl,
            punt_by_yardline=punt_tbl,
            convert_by_season=convert_by_season,
            fg_by_season=fg_by_season,
            punt_by_season=punt_by_season,
            meta={
                "seasons": list(seasons),
                "season_type": "REG",
                "n_go": int(go.sum()),
                "n_fg": int(fg.sum()),
                "n_punt": int(pu.sum()),
                "per_season_n": per_season_n,
                "note": "Fit on train seasons only; never 2023+; pooled + per-season tables",
            },
        )
        return out

    def resolve_table_season(
        self,
        play_season: int | None,
        *,
        mode: EmpiricsMode = "pooled",
    ) -> dict[str, Any]:
        """Choose which empirics table applies; never pulls 2023+ fit seasons."""
        train = [int(s) for s in self.meta.get("seasons", list(self.convert_by_season.keys()))]
        if mode == "pooled" or play_season is None or not self.convert_by_season:
            return {
                "mode": "pooled",
                "play_season": play_season,
                "table_season": None,
                "note": "Pooled REG train empirics",
            }
        s = int(play_season)
        if s in self.convert_by_season:
            return {
                "mode": "season_aware",
                "play_season": s,
                "table_season": s,
                "note": f"Exact train-season table for {s}",
            }
        # Held-out / future relative to fit: use most recent train season ≤ play, else max train.
        candidates = [t for t in train if t <= s]
        table_s = max(candidates) if candidates else (max(train) if train else None)
        return {
            "mode": "season_aware",
            "play_season": s,
            "table_season": table_s,
            "note": (
                f"Play season {s} not in fit set; using most recent train table "
                f"{table_s} (no 2023+ fit)"
            ),
        }

    def _tables_for(
        self,
        play_season: int | None,
        *,
        mode: EmpiricsMode,
    ) -> tuple[
        dict[tuple[int, int], dict[str, Any]],
        dict[tuple[int, int], dict[str, Any]],
        dict[tuple[int, int], dict[str, Any]],
        dict[str, Any],
    ]:
        resolved = self.resolve_table_season(play_season, mode=mode)
        ts = resolved.get("table_season")
        if resolved["mode"] == "season_aware" and ts is not None and int(ts) in self.convert_by_season:
            tsi = int(ts)
            return (
                self.convert_by_season[tsi],
                self.fg_by_season[tsi],
                self.punt_by_season[tsi],
                resolved,
            )
        return self.convert_by_distance, self.fg_by_kick_distance, self.punt_by_yardline, resolved

    def p_convert(
        self,
        distance: float,
        *,
        season: int | None = None,
        mode: EmpiricsMode = "pooled",
    ) -> tuple[float, dict[str, Any]]:
        convert_tbl, _, _, resolved = self._tables_for(season, mode=mode)
        row = dict(_bin_rate(CONVERT_BINS, float(distance), convert_tbl))
        row = {**row, "empirics_resolve": resolved}
        return float(row["p_convert"]), row

    def p_make(
        self,
        kick_distance: float,
        *,
        season: int | None = None,
        mode: EmpiricsMode = "pooled",
    ) -> tuple[float, dict[str, Any]]:
        _, fg_tbl, _, resolved = self._tables_for(season, mode=mode)
        row = dict(_bin_rate(FG_BINS, float(kick_distance), fg_tbl))
        row = {**row, "empirics_resolve": resolved}
        return float(row["p_make"]), row

    def punt_opp_yardline(
        self,
        yardline_100: float,
        *,
        season: int | None = None,
        mode: EmpiricsMode = "pooled",
    ) -> tuple[float, dict[str, Any]]:
        _, _, punt_tbl, resolved = self._tables_for(season, mode=mode)
        row = dict(_bin_rate(PUNT_YARDLINE_BINS, float(yardline_100), punt_tbl))
        row = {**row, "empirics_resolve": resolved}
        return float(row["mean_opp_yardline_100"]), row

    def to_dict(self) -> dict[str, Any]:
        return {
            "meta": self.meta,
            "convert_by_distance": _ser_bins(self.convert_by_distance),
            "fg_by_kick_distance": _ser_bins(self.fg_by_kick_distance),
            "punt_by_yardline": _ser_bins(self.punt_by_yardline),
            "convert_by_season": {str(s): _ser_bins(t) for s, t in self.convert_by_season.items()},
            "fg_by_season": {str(s): _ser_bins(t) for s, t in self.fg_by_season.items()},
            "punt_by_season": {str(s): _ser_bins(t) for s, t in self.punt_by_season.items()},
        }
