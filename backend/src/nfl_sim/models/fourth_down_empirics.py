"""Empirical transition tables for offline 4th-down analysis (train seasons only)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from nfl_sim.models.constants import TRAIN_SEASONS
from nfl_sim.models.dataset import load_raw_seasons
from nfl_sim.models.split import forbid_test_season_in_fit

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


@dataclass
class FourthDownEmpirics:
    """Train-season empirical convert / FG / punt tables."""

    convert_by_distance: dict[tuple[int, int], dict[str, Any]] = field(default_factory=dict)
    fg_by_kick_distance: dict[tuple[int, int], dict[str, Any]] = field(default_factory=dict)
    punt_by_yardline: dict[tuple[int, int], dict[str, Any]] = field(default_factory=dict)
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
        convert_tbl: dict[tuple[int, int], dict[str, Any]] = {}
        for lo, hi in CONVERT_BINS:
            m = yd.ge(lo) & yd.le(hi) & conv.notna()
            n = int(m.sum())
            convert_tbl[(lo, hi)] = {
                "n": n,
                "p_convert": float(conv[m].mean()) if n else 0.4,
                "filter": "REG 4th pass/run with fourth_down_converted",
            }

        # --- FG make ---
        fg = reg & df["play_type"].astype("string").str.lower().eq("field_goal")
        kd = pd.to_numeric(df.loc[fg, "kick_distance"], errors="coerce")
        made = df.loc[fg, "field_goal_result"].astype("string").str.lower().eq("made")
        fg_tbl: dict[tuple[int, int], dict[str, Any]] = {}
        for lo, hi in FG_BINS:
            m = kd.ge(lo) & kd.le(hi)
            n = int(m.sum())
            fg_tbl[(lo, hi)] = {
                "n": n,
                "p_make": float(made[m].mean()) if n else 0.5,
                "filter": "REG play_type=field_goal",
            }

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
        punt_tbl: dict[tuple[int, int], dict[str, Any]] = {}
        for lo, hi in PUNT_YARDLINE_BINS:
            m = yl.ge(lo) & yl.le(hi) & opp_yl.notna()
            n = int(m.sum())
            punt_tbl[(lo, hi)] = {
                "n": n,
                "mean_opp_yardline_100": float(opp_yl[m].mean()) if n else 75.0,
                "filter": "REG punt, punt_blocked==0; TB→opp yardline_100=80",
            }

        out = FourthDownEmpirics(
            convert_by_distance=convert_tbl,
            fg_by_kick_distance=fg_tbl,
            punt_by_yardline=punt_tbl,
            meta={
                "seasons": list(seasons),
                "season_type": "REG",
                "n_go": int(go.sum()),
                "n_fg": int(fg.sum()),
                "n_punt": int(pu.sum()),
                "note": "Fit on train seasons only; never 2023+",
            },
        )
        return out

    def p_convert(self, distance: float) -> tuple[float, dict[str, Any]]:
        row = _bin_rate(CONVERT_BINS, float(distance), self.convert_by_distance)
        return float(row["p_convert"]), row

    def p_make(self, kick_distance: float) -> tuple[float, dict[str, Any]]:
        row = _bin_rate(FG_BINS, float(kick_distance), self.fg_by_kick_distance)
        return float(row["p_make"]), row

    def punt_opp_yardline(self, yardline_100: float) -> tuple[float, dict[str, Any]]:
        row = _bin_rate(PUNT_YARDLINE_BINS, float(yardline_100), self.punt_by_yardline)
        return float(row["mean_opp_yardline_100"]), row

    def to_dict(self) -> dict[str, Any]:
        def _ser(d: dict[tuple[int, int], dict]) -> dict[str, dict]:
            return {f"{a}-{b}": v for (a, b), v in d.items()}

        return {
            "meta": self.meta,
            "convert_by_distance": _ser(self.convert_by_distance),
            "fg_by_kick_distance": _ser(self.fg_by_kick_distance),
            "punt_by_yardline": _ser(self.punt_by_yardline),
        }
