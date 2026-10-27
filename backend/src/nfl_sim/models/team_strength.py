"""Team-aware 4th-down inputs: empirical-Bayes shrinkage, season-to-date only.

For a real game we shift the league conversion and FG make chances by
  offense:  how much better/worse the possession team converts than league average
  defense:  how much more/less the defending team allows conversions
  kicker:   how much better/worse the team's current kicker makes FGs
Each shift is (observed - expected) / (attempts + k): the beta-binomial posterior mean
of the team's residual, shrunk toward 0 (= league average) with k pseudo-attempts.

No future data within a season: a game's team shifts use only that season's plays from games
dated strictly before it (week 1 = league average).

In-sample (QA 0116 P3): the league curves (expected rates) and the priors k are fit once on
full seasons 2019–2023, the same seasons as the WP model fit. So for 2019–2023 games those
league-wide inputs are IN-SAMPLE (they saw the season being annotated, including later weeks);
only 2024–2025 games are out-of-sample for them. They are league-wide, never team-specific.
Internal model inputs only; nothing here is shown to fans.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd

PRIOR_SEASONS: tuple[int, ...] = (2019, 2020, 2021, 2022, 2023)
OUT_OF_SAMPLE_SEASONS: tuple[int, ...] = (2024, 2025)
FIT_SAMPLE = {
    "fit_seasons": list(PRIOR_SEASONS),
    "in_sample_seasons": list(PRIOR_SEASONS),
    "out_of_sample_seasons": list(OUT_OF_SAMPLE_SEASONS),
    "note": "League curves and priors k are fit on full 2019-2023 seasons, so they are in-sample for "
            "2019-2023 games. Team shifts use only that season's earlier games.",
}
MAX_CONVERT_YDSTOGO = 10  # 3rd/4th-and-1..10 runs and passes
MIN_FG, MAX_FG = 18, 70
PBP_COLUMNS = ["game_id", "season", "season_type", "game_date", "posteam", "defteam", "down", "ydstogo",
               "play_type", "first_down", "touchdown", "qb_kneel", "qb_spike", "two_point_attempt",
               "field_goal_result", "kick_distance", "kicker_player_id"]


def conversion_events(pbp: pd.DataFrame) -> pd.DataFrame:
    """3rd/4th-and-≤10 runs and passes; success = first down or TD."""
    m = (pbp["down"].isin([3, 4]) & pbp["play_type"].isin(["run", "pass"])
         & (pbp["ydstogo"] <= MAX_CONVERT_YDSTOGO) & (pbp["qb_kneel"].fillna(0) == 0)
         & (pbp["qb_spike"].fillna(0) == 0) & (pbp["two_point_attempt"].fillna(0) == 0))
    e = pbp.loc[m, ["game_id", "season", "game_date", "posteam", "defteam", "down", "ydstogo"]].copy()
    e["y"] = ((pbp.loc[m, "first_down"].fillna(0) == 1) | (pbp.loc[m, "touchdown"].fillna(0) == 1)).astype(int)
    e["ydstogo"] = e["ydstogo"].astype(int)
    e["down"] = e["down"].astype(int)
    return e


def fg_events(pbp: pd.DataFrame) -> pd.DataFrame:
    m = (pbp["play_type"] == "field_goal") & pbp["kick_distance"].notna() & pbp["kicker_player_id"].notna()
    e = pbp.loc[m, ["game_id", "season", "game_date", "posteam", "kicker_player_id", "kick_distance"]].copy()
    e["y"] = (pbp.loc[m, "field_goal_result"] == "made").astype(int)
    e["kick_distance"] = e["kick_distance"].clip(MIN_FG, MAX_FG).astype(int)
    return e


@dataclass(frozen=True)
class Prior:
    """Beta-binomial prior on a team's residual rate: k pseudo-attempts at league average."""

    k: float
    tau: float  # SD of true team residuals (rate points)
    league_rate: float
    n_groups: int

    def to_dict(self) -> dict[str, float]:
        return {"k": round(self.k, 1), "tau": round(self.tau, 4), "league_rate": round(self.league_rate, 4),
                "n_team_seasons": self.n_groups}


def method_of_moments(o: np.ndarray, e: np.ndarray, n: np.ndarray) -> Prior:
    """tau² = var(observed residual) − mean binomial noise; k = p(1−p)/tau²."""
    o, e, n = (np.asarray(x, float) for x in (o, e, n))
    keep = n > 0
    o, e, n = o[keep], e[keep], n[keep]
    p = float(o.sum() / n.sum())
    r = (o - e) / n
    var_obs = float(np.average(r ** 2, weights=n))  # residuals are centred on 0 by construction
    noise = float(np.average(p * (1 - p) / n, weights=n))
    tau2 = max(var_obs - noise, 1e-6)
    return Prior(k=p * (1 - p) / tau2, tau=float(np.sqrt(tau2)), league_rate=p, n_groups=int(keep.sum()))


@dataclass
class TeamStrengthModel:
    convert_curve: dict[tuple[int, int], float]  # (down, ydstogo) -> league rate
    fg_curve: dict[int, float]  # kick distance -> league make rate
    offense: Prior
    defense: Prior
    kicker: Prior

    @staticmethod
    def fit(pbp_by_season: dict[int, pd.DataFrame], seasons: Iterable[int] = PRIOR_SEASONS) -> "TeamStrengthModel":
        frames = [pbp_by_season[s] for s in seasons]
        conv = pd.concat([conversion_events(f) for f in frames], ignore_index=True)
        fg = pd.concat([fg_events(f) for f in frames], ignore_index=True)
        curve = conv.groupby(["down", "ydstogo"])["y"].mean().to_dict()
        fg_curve = _fg_curve(fg)
        conv["e"] = [curve[(d, y)] for d, y in zip(conv["down"], conv["ydstogo"])]
        fg["e"] = fg["kick_distance"].map(fg_curve)
        priors = {}
        for name, df, key in (("offense", conv, "posteam"), ("defense", conv, "defteam"),
                              ("kicker", fg, "kicker_player_id")):
            g = df.groupby(["season", key]).agg(o=("y", "sum"), e=("e", "sum"), n=("y", "size"))
            priors[name] = method_of_moments(g["o"], g["e"], g["n"])
        return TeamStrengthModel({k: float(v) for k, v in curve.items()}, fg_curve, **priors)

    def priors(self) -> dict[str, dict[str, float]]:
        return {"offense_convert": self.offense.to_dict(), "defense_convert": self.defense.to_dict(),
                "kicker_fg_make": self.kicker.to_dict()}

    def season_shifts(self, pbp: pd.DataFrame) -> pd.DataFrame:
        """One row per (game_id, team): shifts from that season's games dated strictly before it."""
        conv = conversion_events(pbp)
        conv["r"] = conv["y"] - [self.convert_curve.get((d, y), np.nan) for d, y in zip(conv["down"], conv["ydstogo"])]
        conv = conv.dropna(subset=["r"])
        fg = fg_events(pbp)
        fg["r"] = fg["y"] - fg["kick_distance"].map(self.fg_curve)
        games = pbp.drop_duplicates("game_id")[["game_id", "game_date", "home_team", "away_team"]]
        rows = []
        for g in games.itertuples(index=False):
            before_c = conv[conv["game_date"] < g.game_date]
            before_f = fg[fg["game_date"] < g.game_date]
            for team in (g.home_team, g.away_team):
                off = before_c[before_c["posteam"] == team]["r"]
                de = before_c[before_c["defteam"] == team]["r"]
                tf = before_f[before_f["posteam"] == team]
                kicker = tf.sort_values("game_date")["kicker_player_id"].iloc[-1] if len(tf) else None
                kf = before_f[before_f["kicker_player_id"] == kicker]["r"] if kicker is not None else off.iloc[:0]
                rows.append({"game_id": g.game_id, "team": team,
                             "convert_off_shift": _shrink(off, self.offense.k),
                             "convert_def_shift": _shrink(de, self.defense.k),
                             "fg_make_shift": _shrink(kf, self.kicker.k),
                             "n_off": len(off), "n_def": len(de), "n_fg": len(kf)})
        return pd.DataFrame(rows)


def _shrink(resid: pd.Series, k: float) -> float:
    return float(resid.sum() / (len(resid) + k)) if len(resid) else 0.0


def _fg_curve(fg: pd.DataFrame) -> dict[int, float]:
    from sklearn.linear_model import LogisticRegression

    x = fg[["kick_distance"]].to_numpy(float)
    lr = LogisticRegression(C=1e6).fit(np.column_stack([x, x ** 2]), fg["y"])
    d = np.arange(MIN_FG, MAX_FG + 1, dtype=float)
    return dict(zip(d.astype(int).tolist(), lr.predict_proba(np.column_stack([d, d ** 2]))[:, 1].tolist()))
