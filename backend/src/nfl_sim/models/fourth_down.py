"""Offline analytical 4th-down decision values via Path A WP + empirics."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from nfl_sim.models.fourth_down_empirics import EmpiricsMode, FourthDownEmpirics
from nfl_sim.models.wp_model import WPModel

INCONCLUSIVE_EPS = 0.01
CLOCK_DELTA = 6  # seconds drained per branch (toy)
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


def _clip_clock(game: int, half: int, qtr: int) -> tuple[int, int]:
    g = max(0, int(game) - CLOCK_DELTA)
    h = max(0, int(half) - CLOCK_DELTA)
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
) -> dict[str, Any]:
    g, h = _clip_clock(sit.game_seconds_remaining, sit.half_seconds_remaining, sit.qtr)
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


def state_go_convert(sit: FourthDownSituation) -> dict[str, Any]:
    g, h = _clip_clock(sit.game_seconds_remaining, sit.half_seconds_remaining, sit.qtr)
    if sit.distance >= sit.yardline_100:
        # Touchdown then kickoff: opponent possesses at TB yardline; our +7
        # New posteam is opponent: their score_diff = -(old + 7)
        return _flip_possession_state(
            sit,
            opp_yardline_100=KICKOFF_TOUCHBACK_YARDLINE,
            score_differential_for_new_posteam=-(sit.score_differential + 7),
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


def state_go_fail(sit: FourthDownSituation) -> dict[str, Any]:
    return _flip_possession_state(
        sit,
        opp_yardline_100=100 - sit.yardline_100,
        score_differential_for_new_posteam=-sit.score_differential,
    )


def state_fg_make(sit: FourthDownSituation) -> dict[str, Any]:
    return _flip_possession_state(
        sit,
        opp_yardline_100=KICKOFF_TOUCHBACK_YARDLINE,
        score_differential_for_new_posteam=-(sit.score_differential + 3),
    )


def state_fg_miss(sit: FourthDownSituation) -> dict[str, Any]:
    return _flip_possession_state(
        sit,
        opp_yardline_100=100 - sit.yardline_100,
        score_differential_for_new_posteam=-sit.score_differential,
    )


def state_punt(sit: FourthDownSituation, opp_yardline_100: float) -> dict[str, Any]:
    return _flip_possession_state(
        sit,
        opp_yardline_100=int(round(opp_yardline_100)),
        score_differential_for_new_posteam=-sit.score_differential,
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

        s_conv = state_go_convert(sit)
        s_fail = state_go_fail(sit)
        s_make = state_fg_make(sit)
        s_miss = state_fg_miss(sit)
        s_punt = state_punt(sit, punt_yl)

        # WP from current posteam perspective: after possession flip, model returns
        # new posteam WP — convert to original posteam WP via 1 - wp_new.
        wp_conv_raw = self._wp(s_conv)
        wp_fail_raw = self._wp(s_fail)
        wp_make_raw = self._wp(s_make)
        wp_miss_raw = self._wp(s_miss)
        wp_punt_raw = self._wp(s_punt)

        # Convert success keeps possession (unless TD→kickoff flip). Detect flip by posteam home flag.
        def for_original(row: dict[str, Any], wp_raw: float) -> float:
            flipped = bool(row["posteam"] != ("H" if sit.is_home_possession else "A"))
            return (1.0 - wp_raw) if flipped else wp_raw

        wp_conv = for_original(s_conv, wp_conv_raw)
        wp_fail = for_original(s_fail, wp_fail_raw)
        wp_make = for_original(s_make, wp_make_raw)
        wp_miss = for_original(s_miss, wp_miss_raw)
        wp_punt = for_original(s_punt, wp_punt_raw)

        v_go = p_conv * wp_conv + (1.0 - p_conv) * wp_fail
        v_fg = p_make * wp_make + (1.0 - p_make) * wp_miss
        v_punt = wp_punt

        actions = {
            "go": ActionValue(
                "go",
                float(v_go),
                {
                    "p_convert": p_conv,
                    "wp_convert": wp_conv,
                    "wp_fail": wp_fail,
                    "convert_bin": conv_meta,
                    "kick_distance_n/a": None,
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
                },
            ),
            "punt": ActionValue(
                "punt",
                float(v_punt),
                {
                    "opp_yardline_100": punt_yl,
                    "wp_punt": wp_punt,
                    "punt_bin": punt_meta,
                },
            ),
        }
        ordered = sorted(actions.values(), key=lambda a: a.value_wp, reverse=True)
        best, second = ordered[0], ordered[1]
        margin = float(best.value_wp - second.value_wp)
        inconclusive = margin < inconclusive_eps
        rec = "inconclusive" if inconclusive else best.action
        resolve = conv_meta.get("empirics_resolve") or {"mode": empirics_mode}

        return FourthDownResult(
            situation=asdict(sit) | {"kick_distance": kd, "empirics_mode": empirics_mode},
            recommendation=rec,
            margin=margin,
            actions=actions,
            empirics_meta={
                **self.empirics.meta,
                "empirics_mode": empirics_mode,
                "empirics_resolve": resolve,
            },
            assumptions=[
                "Path A uncalibrated WP only (no isotonic)",
                f"Clock −{CLOCK_DELTA}s per branch",
                f"FG distance = yardline_100 + 17; kickoff TB → yardline_100={KICKOFF_TOUCHBACK_YARDLINE}",
                "Go fail / FG miss → opponent at 100−yardline_100",
                "Punt → empirical mean opponent yardline (blocked punts excluded from fit)",
                "Empirics fit REG train 2019–2021 only (never 2023+)",
                f"Empirics mode={empirics_mode}; {resolve.get('note')}",
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
) -> dict[str, Any]:
    """Baseline vs alternate probs; report whether recommendation changes."""
    base = analyzer.analyze(sit, empirics_mode=empirics_mode)
    p0 = base.actions["go"].components["p_convert"]
    m0 = base.actions["fg"].components["p_make"]
    alt = analyzer.analyze(
        sit,
        p_convert_override=float(np.clip(p0 + convert_delta, 0.0, 1.0)),
        p_make_override=float(np.clip(m0 + make_delta, 0.0, 1.0)),
        empirics_mode=empirics_mode,
    )
    return {
        "baseline": base.to_dict(),
        "alternate": alt.to_dict(),
        "convert_delta": convert_delta,
        "make_delta": make_delta,
        "recommendation_changed": base.recommendation != alt.recommendation,
    }
