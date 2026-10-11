"""Offline analytical 4th-down decision values via Path A WP + empirics."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from nfl_sim.models.fourth_down_empirics import EmpiricsMode, FourthDownEmpirics, TransitionMode
from nfl_sim.models.wp_model import WPModel

INCONCLUSIVE_EPS = 0.01
CLOCK_DELTA = 6  # seconds drained per branch (legacy toy)
KICKOFF_TOUCHBACK_YARDLINE = 75  # receiving team yardline_100 after TB


@dataclass
class FourthDownSituation:
    """Pre-snap 4th-down state (possession-team perspective)."""

    yardline_100: int
    distance: int
    score_differential: int  # posteam − defteam
    game_seconds_remaining: int
    half_seconds_remaining: int
    qtr: int = 4
    posteam_timeouts: int = 2
    defteam_timeouts: int = 2
    is_home_possession: bool = True
    receive_2h_ko: int = 0
    season: int = 2022

    def __post_init__(self) -> None:
        if not (1 <= int(self.distance) <= 99):
            raise ValueError("distance out of range")
        if not (1 <= int(self.yardline_100) <= 99):
            raise ValueError("yardline_100 out of range")


def _clip_clock(game: int, half: int, delta: int = CLOCK_DELTA) -> tuple[int, int]:
    d = max(0, int(delta))
    g = max(0, int(game) - d)
    h = max(0, int(half) - d)
    return g, h


def _row_from_state(
    *,
    yardline_100: int,
    distance: int,
    down: int,
    score_differential: int,
    game_seconds_remaining: int,
    half_seconds_remaining: int,
    qtr: int,
    posteam_timeouts: int,
    defteam_timeouts: int,
    is_home_possession: bool,
    receive_2h_ko: int,
    season: int,
) -> dict[str, Any]:
    home = "H"
    away = "A"
    posteam = home if is_home_possession else away
    r2h = int(receive_2h_ko) if qtr <= 2 else 0
    return {
        "down": int(down),
        "ydstogo": int(distance),
        "yardline_100": int(np.clip(yardline_100, 1, 99)),
        "score_differential": int(score_differential),
        "game_seconds_remaining": int(max(0, game_seconds_remaining)),
        "half_seconds_remaining": int(max(0, half_seconds_remaining)),
        "qtr": int(qtr),
        "posteam_timeouts_remaining": int(posteam_timeouts),
        "defteam_timeouts_remaining": int(defteam_timeouts),
        "posteam": posteam,
        "home_team": home,
        "away_team": away,
        "season": int(season),
        "receive_2h_ko": r2h,
        "roof": "outdoors",
    }


def _flip_possession_state(
    sit: FourthDownSituation,
    *,
    opp_yardline_100: int,
    score_differential_for_new_posteam: int,
    down: int = 1,
    distance: int = 10,
    clock_delta: int = CLOCK_DELTA,
) -> dict[str, Any]:
    g, h = _clip_clock(sit.game_seconds_remaining, sit.half_seconds_remaining, clock_delta)
    return _row_from_state(
        yardline_100=int(np.clip(opp_yardline_100, 1, 99)),
        distance=distance,
        down=down,
        score_differential=int(score_differential_for_new_posteam),
        game_seconds_remaining=g,
        half_seconds_remaining=h,
        qtr=sit.qtr,
        # timeouts: swapped with possession
        posteam_timeouts=sit.defteam_timeouts,
        defteam_timeouts=sit.posteam_timeouts,
        is_home_possession=not sit.is_home_possession,
        receive_2h_ko=0,
        season=sit.season,
    )


def state_go_convert(sit: FourthDownSituation, *, clock_delta: int = CLOCK_DELTA) -> dict[str, Any]:
    g, h = _clip_clock(sit.game_seconds_remaining, sit.half_seconds_remaining, clock_delta)
    if sit.distance >= sit.yardline_100:
        # Touchdown then kickoff: opponent possesses at TB yardline; our +7
        # New posteam is opponent: their score_diff = -(old + 7)
        return _flip_possession_state(
            sit,
            opp_yardline_100=KICKOFF_TOUCHBACK_YARDLINE,
            score_differential_for_new_posteam=-(sit.score_differential + 7),
            clock_delta=clock_delta,
        )
    new_yl = max(1, sit.yardline_100 - sit.distance)
    return _row_from_state(
        yardline_100=new_yl,
        distance=10,
        down=1,
        score_differential=sit.score_differential,
        game_seconds_remaining=g,
        half_seconds_remaining=h,
        qtr=sit.qtr,
        posteam_timeouts=sit.posteam_timeouts,
        defteam_timeouts=sit.defteam_timeouts,
        is_home_possession=sit.is_home_possession,
        receive_2h_ko=sit.receive_2h_ko,
        season=sit.season,
    )


def state_go_fail(sit: FourthDownSituation, *, clock_delta: int = CLOCK_DELTA) -> dict[str, Any]:
    return _flip_possession_state(
        sit,
        opp_yardline_100=100 - sit.yardline_100,
        score_differential_for_new_posteam=-sit.score_differential,
        clock_delta=clock_delta,
    )


def state_fg_make(sit: FourthDownSituation, *, clock_delta: int = CLOCK_DELTA) -> dict[str, Any]:
    return _flip_possession_state(
        sit,
        opp_yardline_100=KICKOFF_TOUCHBACK_YARDLINE,
        score_differential_for_new_posteam=-(sit.score_differential + 3),
        clock_delta=clock_delta,
    )


def state_fg_miss(sit: FourthDownSituation, *, clock_delta: int = CLOCK_DELTA) -> dict[str, Any]:
    return _flip_possession_state(
        sit,
        opp_yardline_100=100 - sit.yardline_100,
        score_differential_for_new_posteam=-sit.score_differential,
        clock_delta=clock_delta,
    )


def state_punt(
    sit: FourthDownSituation,
    opp_yardline_100: float,
    *,
    clock_delta: int = CLOCK_DELTA,
) -> dict[str, Any]:
    return _flip_possession_state(
        sit,
        opp_yardline_100=int(round(opp_yardline_100)),
        score_differential_for_new_posteam=-sit.score_differential,
        clock_delta=clock_delta,
    )


def kick_distance(sit: FourthDownSituation) -> int:
    return int(sit.yardline_100 + 17)


@dataclass
class ActionValue:
    action: str
    value_wp: float
    components: dict[str, Any]


@dataclass
class FourthDownResult:
    situation: dict[str, Any]
    recommendation: str
    margin: float
    actions: dict[str, ActionValue]
    empirics_meta: dict[str, Any]
    assumptions: list[str]
    inconclusive: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "situation": self.situation,
            "recommendation": self.recommendation,
            "margin": self.margin,
            "inconclusive": self.inconclusive,
            "actions": {
                k: {"action": v.action, "value_wp": v.value_wp, "components": v.components}
                for k, v in self.actions.items()
            },
            "empirics_meta": self.empirics_meta,
            "assumptions": self.assumptions,
        }


class FourthDownAnalyzer:
    """Score go / FG / punt with a frozen Path A WP model + train empirics."""

    def __init__(self, model: WPModel, empirics: FourthDownEmpirics) -> None:
        self.model = model
        self.empirics = empirics

    @staticmethod
    def load(model_path: Path, empirics: FourthDownEmpirics | None = None) -> FourthDownAnalyzer:
        model = WPModel.load(Path(model_path))
        emp = empirics or FourthDownEmpirics.fit_from_seasons()
        return FourthDownAnalyzer(model, emp)

    def _wp(self, row: dict[str, Any]) -> float:
        df = pd.DataFrame([row])
        return float(self.model.predict_wp(df)[0])

    def analyze(
        self,
        sit: FourthDownSituation,
        *,
        p_convert_override: float | None = None,
        p_make_override: float | None = None,
        inconclusive_eps: float = INCONCLUSIVE_EPS,
        empirics_mode: EmpiricsMode = "pooled",
        transition_mode: TransitionMode = "legacy",
    ) -> FourthDownResult:
        p_conv, conv_meta = self.empirics.p_convert(
            sit.distance, season=sit.season, mode=empirics_mode
        )
        if p_convert_override is not None:
            p_conv = float(np.clip(p_convert_override, 0.0, 1.0))
        kd = kick_distance(sit)
        p_make, fg_meta = self.empirics.p_make(kd, season=sit.season, mode=empirics_mode)
        if p_make_override is not None:
            p_make = float(np.clip(p_make_override, 0.0, 1.0))
        punt_yl, punt_meta = self.empirics.punt_opp_yardline(
            sit.yardline_100, season=sit.season, mode=empirics_mode
        )

        clk = {
            "go_convert": self.empirics.clock_delta("go_convert", transition_mode=transition_mode),
            "go_fail": self.empirics.clock_delta("go_fail", transition_mode=transition_mode),
            "fg_make": self.empirics.clock_delta("fg_make", transition_mode=transition_mode),
            "fg_miss": self.empirics.clock_delta("fg_miss", transition_mode=transition_mode),
            "punt": self.empirics.clock_delta("punt", transition_mode=transition_mode),
        }

        s_conv = state_go_convert(sit, clock_delta=clk["go_convert"])
        s_fail = state_go_fail(sit, clock_delta=clk["go_fail"])
        s_make = state_fg_make(sit, clock_delta=clk["fg_make"])
        s_miss = state_fg_miss(sit, clock_delta=clk["fg_miss"])

        # WP from current posteam perspective: after possession flip, model returns
        # new posteam WP — convert to original posteam WP via 1 - wp_new.
        def for_original(row: dict[str, Any], wp_raw: float) -> float:
            flipped = bool(row["posteam"] != ("H" if sit.is_home_possession else "A"))
            return (1.0 - wp_raw) if flipped else wp_raw

        wp_conv = for_original(s_conv, self._wp(s_conv))
        wp_fail = for_original(s_fail, self._wp(s_fail))
        wp_make = for_original(s_make, self._wp(s_make))
        wp_miss = for_original(s_miss, self._wp(s_miss))

        v_go = p_conv * wp_conv + (1.0 - p_conv) * wp_fail
        v_fg = p_make * wp_make + (1.0 - p_make) * wp_miss

        punt_components: dict[str, Any] = {
            "opp_yardline_100_mean": punt_yl,
            "punt_bin": punt_meta,
            "clock_delta": clk["punt"],
            "transition_mode": transition_mode,
        }
        if transition_mode == "improved":
            buckets, bucket_meta = self.empirics.punt_buckets(
                sit.yardline_100, season=sit.season, mode=empirics_mode
            )
            bucket_rows = []
            v_punt = 0.0
            for b in buckets:
                yl_b = float(b["opp_yardline_100"])
                w = float(b["weight"])
                s_b = state_punt(sit, yl_b, clock_delta=clk["punt"])
                wp_b = for_original(s_b, self._wp(s_b))
                v_punt += w * wp_b
                bucket_rows.append(
                    {
                        "label": b.get("label"),
                        "opp_yardline_100": yl_b,
                        "weight": w,
                        "wp": wp_b,
                    }
                )
            punt_components.update(
                {
                    "method": "expectation over q25/q50/q75 opp yardline buckets",
                    "buckets": bucket_rows,
                    "punt_bin": bucket_meta,
                    "wp_punt_mean_spot": for_original(
                        state_punt(sit, punt_yl, clock_delta=clk["punt"]),
                        self._wp(state_punt(sit, punt_yl, clock_delta=clk["punt"])),
                    ),
                }
            )
        else:
            s_punt = state_punt(sit, punt_yl, clock_delta=clk["punt"])
            v_punt = for_original(s_punt, self._wp(s_punt))
            punt_components.update(
                {
                    "method": "mean opp yardline (legacy)",
                    "opp_yardline_100": punt_yl,
                    "wp_punt": v_punt,
                }
            )

        actions = {
            "go": ActionValue(
                "go",
                float(v_go),
                {
                    "p_convert": p_conv,
                    "wp_convert": wp_conv,
                    "wp_fail": wp_fail,
                    "convert_bin": conv_meta,
                    "clock_delta_convert": clk["go_convert"],
                    "clock_delta_fail": clk["go_fail"],
                },
            ),
            "fg": ActionValue(
                "fg",
                float(v_fg),
                {
                    "p_make": p_make,
                    "kick_distance": kd,
                    "wp_make": wp_make,
                    "wp_miss": wp_miss,
                    "fg_bin": fg_meta,
                    "clock_delta_make": clk["fg_make"],
                    "clock_delta_miss": clk["fg_miss"],
                },
            ),
            "punt": ActionValue("punt", float(v_punt), punt_components),
        }
        ordered = sorted(actions.values(), key=lambda a: a.value_wp, reverse=True)
        best, second = ordered[0], ordered[1]
        margin = float(best.value_wp - second.value_wp)
        inconclusive = margin < inconclusive_eps
        rec = "inconclusive" if inconclusive else best.action
        resolve = conv_meta.get("empirics_resolve") or {"mode": empirics_mode}

        if transition_mode == "improved":
            clock_note = (
                "Outcome-dependent clock = REG train median Δgame_seconds to next play "
                f"(go_convert={clk['go_convert']}s, go_fail={clk['go_fail']}s, "
                f"fg_make={clk['fg_make']}s, fg_miss={clk['fg_miss']}s, punt={clk['punt']}s)"
            )
            punt_note = "Punt → E[WP] over empirical q25/q50/q75 opp yardline buckets (TB→80 in fit)"
        else:
            clock_note = f"Clock −{CLOCK_DELTA}s per branch (legacy toy)"
            punt_note = "Punt → empirical mean opponent yardline (blocked punts excluded from fit)"

        return FourthDownResult(
            situation=asdict(sit)
            | {
                "kick_distance": kd,
                "empirics_mode": empirics_mode,
                "transition_mode": transition_mode,
            },
            recommendation=rec,
            margin=margin,
            actions=actions,
            empirics_meta={
                **self.empirics.meta,
                "empirics_mode": empirics_mode,
                "empirics_resolve": resolve,
                "transition_mode": transition_mode,
                "clock_deltas_used": clk,
            },
            assumptions=[
                "Path A uncalibrated WP only (no isotonic)",
                clock_note,
                f"FG distance = yardline_100 + 17; kickoff TB → yardline_100={KICKOFF_TOUCHBACK_YARDLINE}",
                "Go fail / FG miss → opponent at 100−yardline_100",
                punt_note,
                "Empirics fit REG train 2019–2021 only (never 2023+)",
                f"Empirics mode={empirics_mode}; {resolve.get('note')}",
                f"Transition mode={transition_mode}",
            ],
            inconclusive=inconclusive,
        )


def sensitivity_example(
    analyzer: FourthDownAnalyzer,
    sit: FourthDownSituation,
    *,
    convert_delta: float = -0.10,
    make_delta: float = 0.0,
    empirics_mode: EmpiricsMode = "pooled",
    transition_mode: TransitionMode = "legacy",
) -> dict[str, Any]:
    """Baseline vs alternate probs; report whether recommendation changes."""
    base = analyzer.analyze(sit, empirics_mode=empirics_mode, transition_mode=transition_mode)
    p0 = base.actions["go"].components["p_convert"]
    m0 = base.actions["fg"].components["p_make"]
    alt = analyzer.analyze(
        sit,
        p_convert_override=float(np.clip(p0 + convert_delta, 0.0, 1.0)),
        p_make_override=float(np.clip(m0 + make_delta, 0.0, 1.0)),
        empirics_mode=empirics_mode,
        transition_mode=transition_mode,
    )
    return {
        "baseline": base.to_dict(),
        "alternate": alt.to_dict(),
        "convert_delta": convert_delta,
        "make_delta": make_delta,
        "recommendation_changed": base.recommendation != alt.recommendation,
    }
