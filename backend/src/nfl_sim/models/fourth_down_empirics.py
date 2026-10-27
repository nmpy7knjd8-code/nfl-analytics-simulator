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
FG_MIN_KICK = 18  # per-yard table starts here (shortest real kicks are 18-19 yd)

# Legacy FG kick-distance bands (older pickles / toy tests only). Fits are per-yard now.
FG_BINS: tuple[tuple[int, int], ...] = (
    (18, 29),
    (30, 39),
    (40, 49),
    (50, 59),
)

# Legacy pre-punt yardline_100 bands (pre-H8 pickles and toy tests); fits are per-yard now.
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


def _build_fg_table(kd: pd.Series, made: pd.Series) -> dict[tuple[int, int], dict[str, Any]]:
    """M12: per-yard make probability from ONE logistic fit on kick distance.

    The old 10-yd bins (plus a separate tail fit from 60 yd) made the FG value drop in
    steps at 30/40/50/60 yd (up to 9 WP pts between opp 41 and 42). Now every yard from
    FG_MIN_KICK to the longest attempt in the fit data gets p = logistic(a + b*kd); past
    the longest attempt there is no evidence and p_make returns 0.
    """
    ok = kd.notna()
    kd, made = kd[ok].astype(float), made[ok].astype(bool)
    if kd.empty or made.nunique() < 2:
        return {(lo, hi): {"n": int(kd.between(lo, hi).sum()), "p_make": 0.5, "filter": "REG field_goal; no fit"}
                for lo, hi in FG_BINS}
    a, b = _logit_fit(kd.to_numpy(), made.to_numpy().astype(float))
    longest = int(kd.max())
    tbl: dict[tuple[int, int], dict[str, Any]] = {}
    for yd in range(FG_MIN_KICK, longest + 1):
        at = kd.round().eq(yd)
        tbl[(yd, yd)] = {
            "n": int(at.sum()),
            "made": int(made[at].sum()),
            "p_make": float(1.0 / (1.0 + np.exp(-(a + b * yd)))),
            "filter": f"REG field_goal; logistic fit on kick_distance over {len(kd)} attempts "
                      f"(longest {longest} yd)",
        }
    return tbl


# Punt outcomes are priced yard by yard (H8): a Gaussian kernel over nearby pre-punt
# yard lines, so the punt value moves smoothly up the field instead of in flat bands.
PUNT_KERNEL_YARDS = 4.0
PUNT_KERNEL_MIN_N = 200.0
PUNT_MONOTONE_FROM = 50  # widen the kernel where punts are rare (deep in opp territory)


def _wquantile(v: np.ndarray, w: np.ndarray, q: float) -> float:
    o = np.argsort(v)
    v, w = v[o], w[o]
    cw = np.cumsum(w) - 0.5 * w
    return float(np.interp(q * w.sum(), cw, v))


# Punt outcomes are priced yard by yard (H8): a Gaussian kernel over nearby pre-punt
# yard lines, so the punt value moves smoothly up the field instead of in flat bands.
PUNT_KERNEL_YARDS = 4.0
PUNT_KERNEL_MIN_N = 200.0
PUNT_MONOTONE_FROM = 50  # widen the kernel where punts are rare (deep in opp territory)


def _wquantile(v: np.ndarray, w: np.ndarray, q: float) -> float:
    o = np.argsort(v)
    v, w = v[o], w[o]
    cw = np.cumsum(w) - 0.5 * w
    return float(np.interp(q * w.sum(), cw, v))


def _build_punt_table(
    yl: pd.Series,
    opp_yl: pd.Series,
    tb: pd.Series | None = None,
) -> dict[tuple[int, int], dict[str, Any]]:
    """Per-yard (1-yd bins, 1..99) kernel-smoothed punt outcome: mean + q25/q50/q75.

    Non-increasing only from our own 50 back: nearer midfield touchbacks really do make
    short punts land worse than coffin-corner ones. TB already → opp 80.
    """
    ok = yl.notna() & opp_yl.notna()
    x = yl[ok].to_numpy(float)
    v = opp_yl[ok].to_numpy(float)
    t = tb[ok].to_numpy(float) if tb is not None else None
    if len(x) == 0:
        return {(y, y): {"n": 0, "mean_opp_yardline_100": 75.0, "tb_rate": None,
                         "buckets": [{"label": "fallback", "opp_yardline_100": 75.0, "weight": 1.0}],
                         "filter": "no punts"} for y in range(1, 100)}
    ys = np.arange(1, 100)
    stats = {k: np.zeros(len(ys)) for k in ("mean", "q25", "q50", "q75", "tb", "n")}
    for i, y in enumerate(ys):
        h = PUNT_KERNEL_YARDS
        while True:
            w = np.exp(-0.5 * ((x - y) / h) ** 2)
            if w.sum() >= PUNT_KERNEL_MIN_N or h > 60:
                break
            h *= 1.5
        stats["mean"][i] = float((w * v).sum() / w.sum())
        for q, k in ((0.25, "q25"), (0.5, "q50"), (0.75, "q75")):
            stats[k][i] = _wquantile(v, w, q)
        stats["tb"][i] = float((w * t).sum() / w.sum()) if t is not None else np.nan
        stats["n"][i] = float(w.sum())
    # Past PUNT_MONOTONE_FROM (own half, no touchback pull) punting from farther back
    # can't leave the opponent worse field: running minimum, so sparse deep-own-end-zone
    # punts don't bend the curve back up.
    deep = ys >= PUNT_MONOTONE_FROM
    for k in ("mean", "q25", "q50", "q75"):
        stats[k][deep] = np.minimum.accumulate(stats[k][deep])
    punt_tbl: dict[tuple[int, int], dict[str, Any]] = {}
    for i, y in enumerate(ys):
        punt_tbl[(int(y), int(y))] = {
            "n": int(((x >= y - 0.5) & (x < y + 0.5)).sum()),
            "kernel_n": round(stats["n"][i], 1),
            "mean_opp_yardline_100": float(stats["mean"][i]),
            "tb_rate": None if t is None else float(stats["tb"][i]),
            "buckets": [
                {"label": "q25", "opp_yardline_100": float(stats["q25"][i]), "weight": 0.25},
                {"label": "q50", "opp_yardline_100": float(stats["q50"][i]), "weight": 0.50},
                {"label": "q75", "opp_yardline_100": float(stats["q75"][i]), "weight": 0.25},
            ],
            "filter": (f"REG punt, punt_blocked==0; TB→opp yardline_100=80; Gaussian kernel "
                       f"{PUNT_KERNEL_YARDS:g} yd (widened to >= {PUNT_KERNEL_MIN_N:g} punts); "
                       f"non-increasing from yardline {PUNT_MONOTONE_FROM}; buckets=q25/q50/q75"),
        }
    return punt_tbl


def _punt_row(punt_tbl: dict[tuple[int, int], dict], yardline_100: float) -> dict:
    """Look up the punt row; works for per-yard tables and older banded pickles."""
    bins = tuple(sorted(punt_tbl))
    x = float(yardline_100)
    if bins[0][0] == bins[0][1]:  # per-yard table
        x = min(max(round(x), bins[0][0]), bins[-1][1])
    return _bin_rate(bins, x, punt_tbl)


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
            per_yard = bins[0][0] == bins[0][1]
            row = dict(_bin_rate(bins, round(kd) if per_yard or kd >= TAIL_START else kd, fg_tbl))
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
        row = dict(_punt_row(punt_tbl, yardline_100))
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
        row = dict(_punt_row(punt_tbl, yardline_100))
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
