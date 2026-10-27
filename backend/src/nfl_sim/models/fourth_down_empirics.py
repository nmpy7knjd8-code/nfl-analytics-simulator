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
TransitionMode = Literal["legacy", "improved"]

# Play-duration filter for outcome clock (game_seconds_remaining delta to next play)
CLOCK_DT_MIN = 1
CLOCK_DT_MAX = 55

# Distance bins for conversion (inclusive)
CONVERT_BINS: tuple[tuple[int, int], ...] = (
    (1, 1),
    (2, 2),
    (3, 3),
    (4, 5),
    (6, 10),
    (11, 99),
)

# PRODUCT rule, not a model limit: we never OFFER a field goal longer than this.
# Kicks past 64 yd are real (nflverse has makes of 66–68 yd); the make model below
# still prices them from the data, but p_make flags them out_of_range and the
# analyzer drops the FG option.
MAX_FG_DISTANCE = 64
# nflverse kick_distance = yardline_100 + 18 (end zone 10 + ~7-8 yd snap/hold). Single source.
FG_SNAP_YARDS = 18

# Make-probability tail: from TAIL_START yd up to the longest attempt in the fit data,
# p_make comes from a logistic fit on every attempt >= TAIL_FIT_FROM yd (no hardcoded
# record distance). Past the longest attempt in the data there is no evidence: p = 0.
TAIL_START = 60
TAIL_FIT_FROM = 50

# Kick distance bins for FG (top bin ends at MAX_FG_DISTANCE — no 60–80 catch-all)
FG_BINS: tuple[tuple[int, int], ...] = (
    (18, 29),
    (30, 39),
    (40, 49),
    (50, 59),
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
    # Below the first bin: clamp to it (e.g. very short distances). Above the last bin
    # we refuse instead of silently reusing the top bin's rate — that silent clamp is
    # how 70+ yd field goals used to get a real make probability.
    if x < bins[0][0]:
        return table[bins[0]]
    raise ValueError(f"{x} is beyond the last bin {bins[-1]}")


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


def _logit_fit(x: np.ndarray, y: np.ndarray, iters: int = 50) -> tuple[float, float]:
    """Logistic regression y ~ a + b*x by Newton/IRLS (tiny, dependency-free)."""
    X = np.column_stack([np.ones_like(x), x])
    w = np.zeros(2)
    for _ in range(iters):
        p = 1.0 / (1.0 + np.exp(-(X @ w)))
        H = X.T @ (X * (p * (1 - p))[:, None]) + 1e-6 * np.eye(2)
        step = np.linalg.solve(H, X.T @ (y - p))
        w += step
        if np.abs(step).max() < 1e-10:
            break
    return float(w[0]), float(w[1])


def _build_fg_tail(kd: pd.Series, made: pd.Series) -> dict[tuple[int, int], dict[str, Any]]:
    """1-yd bins from TAIL_START to the longest attempt, priced by a logistic fit."""
    ok = kd.notna()
    kd, made = kd[ok].astype(float), made[ok].astype(bool)
    if kd.empty or kd.max() < TAIL_START:
        return {}
    fit = kd >= TAIL_FIT_FROM
    if int(fit.sum()) < 10 or made[fit].nunique() < 2:
        return {}
    a, b = _logit_fit(kd[fit].to_numpy(), made[fit].to_numpy().astype(float))
    longest = int(kd.max())
    tail: dict[tuple[int, int], dict[str, Any]] = {}
    for yd in range(TAIL_START, longest + 1):
        at = kd.round().eq(yd)
        tail[(yd, yd)] = {
            "n": int(at.sum()),
            "made": int(made[at].sum()),
            "p_make": float(1.0 / (1.0 + np.exp(-(a + b * yd)))),
            "filter": f"REG field_goal; logistic tail fit on {int(fit.sum())} attempts >= {TAIL_FIT_FROM} yd "
                      f"(longest attempt {longest} yd)",
        }
    return tail


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
    fg_tbl.update(_build_fg_tail(kd, made))
    return fg_tbl


def _build_punt_table(
    yl: pd.Series,
    opp_yl: pd.Series,
    tb: pd.Series | None = None,
) -> dict[tuple[int, int], dict[str, Any]]:
    """Mean + quantile buckets for variance-aware punt (TB already mapped to opp 80)."""
    punt_tbl: dict[tuple[int, int], dict[str, Any]] = {}
    for lo, hi in PUNT_YARDLINE_BINS:
        m = yl.ge(lo) & yl.le(hi) & opp_yl.notna()
        n = int(m.sum())
        if n:
            vals = opp_yl[m]
            q25 = float(vals.quantile(0.25))
            q50 = float(vals.quantile(0.50))
            q75 = float(vals.quantile(0.75))
            buckets = [
                {"label": "q25", "opp_yardline_100": q25, "weight": 0.25},
                {"label": "q50", "opp_yardline_100": q50, "weight": 0.50},
                {"label": "q75", "opp_yardline_100": q75, "weight": 0.25},
            ]
            mean_yl = float(vals.mean())
            tb_rate = float(tb[m].mean()) if tb is not None else None
        else:
            buckets = [{"label": "fallback", "opp_yardline_100": 75.0, "weight": 1.0}]
            mean_yl = 75.0
            tb_rate = None
        punt_tbl[(lo, hi)] = {
            "n": n,
            "mean_opp_yardline_100": mean_yl,
            "tb_rate": tb_rate,
            "buckets": buckets,
            "filter": "REG punt, punt_blocked==0; TB→opp yardline_100=80; buckets=q25/q50/q75",
        }
    return punt_tbl


def _clock_stat(dt: pd.Series) -> dict[str, Any]:
    n = int(dt.notna().sum())
    return {
        "n": n,
        "median": float(dt.median()) if n else float(6),
        "mean": float(dt.mean()) if n else float(6),
        "p25": float(dt.quantile(0.25)) if n else float(6),
        "p75": float(dt.quantile(0.75)) if n else float(6),
    }


def _fit_outcome_clock(df: pd.DataFrame, reg: pd.Series) -> dict[str, Any]:
    """Median game-clock drain by outcome from REG train (next-play delta)."""
    ordered = df.sort_values(["game_id", "play_id"], kind="mergesort")
    next_g = ordered.groupby("game_id", sort=False)["game_seconds_remaining"].shift(-1)
    gsec = pd.to_numeric(ordered["game_seconds_remaining"], errors="coerce")
    dt = gsec - pd.to_numeric(next_g, errors="coerce")
    ok = reg.reindex(ordered.index).fillna(False) & dt.between(CLOCK_DT_MIN, CLOCK_DT_MAX)

    play = ordered["play_type"].astype("string").str.lower()
    down = pd.to_numeric(ordered["down"], errors="coerce")
    go = ok & down.eq(4) & play.isin(["pass", "run"])
    conv = pd.to_numeric(ordered["fourth_down_converted"], errors="coerce")
    fg = ok & play.eq("field_goal")
    made = ordered["field_goal_result"].astype("string").str.lower().eq("made")
    pu = (
        ok
        & play.eq("punt")
        & pd.to_numeric(ordered["punt_blocked"], errors="coerce").fillna(0).eq(0)
    )
    return {
        "method": (
            f"median Δgame_seconds_remaining to next play; REG; "
            f"dt∈[{CLOCK_DT_MIN},{CLOCK_DT_MAX}]; blocked punts excluded"
        ),
        "go_convert": _clock_stat(dt.loc[go & conv.eq(1)]),
        "go_fail": _clock_stat(dt.loc[go & conv.eq(0)]),
        "fg_make": _clock_stat(dt.loc[fg & made]),
        "fg_miss": _clock_stat(dt.loc[fg & ~made]),
        "punt": _clock_stat(dt.loc[pu]),
        "legacy_toy_seconds": 6,
    }


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
    clock_by_outcome: dict[str, Any] = field(default_factory=dict)
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
        punt_tbl = _build_punt_table(yl, opp_yl, tb=tb)
        clock_by_outcome = _fit_outcome_clock(df, reg)

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
            if not any(lo >= TAIL_START for lo, _ in fg_by_season[s_i]):
                # Too few long kicks in one season to fit a tail: reuse the pooled tail.
                fg_by_season[s_i].update({k: v for k, v in fg_tbl.items() if k[0] >= TAIL_START})
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
            punt_by_season[s_i] = _build_punt_table(yl_s, opp_s, tb=tb_s)
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
            clock_by_outcome=clock_by_outcome,
            meta={
                "seasons": list(seasons),
                "season_type": "REG",
                "n_go": int(go.sum()),
                "n_fg": int(fg.sum()),
                "n_punt": int(pu.sum()),
                "per_season_n": per_season_n,
                "clock_by_outcome": {
                    k: clock_by_outcome[k]
                    for k in ("go_convert", "go_fail", "fg_make", "fg_miss", "punt")
                },
                "note": (
                    "Fit on train seasons only; never 2023+; pooled + per-season tables; "
                    "punt quantile buckets + outcome clock medians"
                ),
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
        kd = float(kick_distance)
        # Bins come from the table itself so older pickled tables still resolve.
        bins = tuple(sorted(fg_tbl))
        if kd > bins[-1][1]:
            row = {"n": 0, "p_make": 0.0, "beyond_data": True,
                   "filter": f"kick_distance > longest attempt in the data ({bins[-1][1]} yd)"}
        else:
            row = dict(_bin_rate(bins, round(kd) if kd >= TAIL_START else kd, fg_tbl))
        if kd > MAX_FG_DISTANCE:
            # Product rule: priced from the data, but never offered.
            row["out_of_range"] = True
            row["filter"] = f"{row['filter']}; not offered: kick_distance > {MAX_FG_DISTANCE} yd"
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

    def punt_buckets(
        self,
        yardline_100: float,
        *,
        season: int | None = None,
        mode: EmpiricsMode = "pooled",
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """Quantile buckets for variance-aware punt expectation."""
        _, _, punt_tbl, resolved = self._tables_for(season, mode=mode)
        row = dict(_bin_rate(PUNT_YARDLINE_BINS, float(yardline_100), punt_tbl))
        buckets = list(row.get("buckets") or [])
        if not buckets:
            mean_yl = float(row.get("mean_opp_yardline_100", 75.0))
            buckets = [{"label": "mean", "opp_yardline_100": mean_yl, "weight": 1.0}]
        meta = {**row, "empirics_resolve": resolved}
        return buckets, meta

    def clock_delta(self, outcome: str, *, transition_mode: TransitionMode = "legacy") -> int:
        """Seconds to subtract from game/half clock for a branch outcome."""
        if transition_mode == "legacy" or not self.clock_by_outcome:
            return 6
        row = self.clock_by_outcome.get(outcome) or {}
        med = row.get("median")
        if med is None:
            return 6
        return max(0, int(round(float(med))))

    def to_dict(self) -> dict[str, Any]:
        return {
            "meta": self.meta,
            "convert_by_distance": _ser_bins(self.convert_by_distance),
            "fg_by_kick_distance": _ser_bins(self.fg_by_kick_distance),
            "punt_by_yardline": _ser_bins(self.punt_by_yardline),
            "convert_by_season": {str(s): _ser_bins(t) for s, t in self.convert_by_season.items()},
            "fg_by_season": {str(s): _ser_bins(t) for s, t in self.fg_by_season.items()},
            "punt_by_season": {str(s): _ser_bins(t) for s, t in self.punt_by_season.items()},
            "clock_by_outcome": self.clock_by_outcome,
        }
