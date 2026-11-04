"""THE 4th-down engine. One function, used by every product.

The checker grid, the daily pack, game files and coach aggregates all call
``FourthDownEngine.evaluate`` and nothing else, so for the same ``EngineInput`` they
get byte-identical values (Phase 3 parity). Values are rounded here, once, so that
JSON round-trips can't introduce drift between products.

Option rules (brief C4):
- Kick (FG) is unavailable when the kick would be > MAX_FG_DISTANCE (64) yards.
- Punt is unavailable inside the opponent 35 (yardline_100 <= 35).
- Go is always available.
"Close call": best and second-best options within CLOSE_CALL_PTS points of win chance.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any, Literal

from nfl_sim.models.fourth_down import FourthDownAnalyzer, FourthDownSituation
from nfl_sim.models.fourth_down_empirics import MAX_FG_DISTANCE

ENGINE_VERSION = "fourth_down_engine.v3"  # v2: H6 post-play state fixes; v3: scoring-zone drive outcomes late
TRANSITION_MODE = "improved"
EMPIRICS_MODE = "pooled"
PUNT_MIN_YARDLINE_100 = 35  # punt offered from the opponent 35 and farther back (inclusive)
CLOSE_CALL_PTS = 2.0
from nfl_sim.models.fourth_down import FG_SNAP_YARDS  # noqa: E402  (one source: yardline_100 + 18)
DECIMALS = 4

Option = Literal["go", "fg", "punt"]


@dataclass(frozen=True)
class EngineInput:
    """Pre-snap 4th down, possession-team view. All fields are plain ints/bools."""

    yardline_100: int
    distance: int
    score_differential: int  # posteam − defteam
    qtr: int
    quarter_seconds_remaining: int
    posteam_timeouts: int = 3
    defteam_timeouts: int = 3
    is_home_possession: bool = True
    # None = unknown coin toss: first-half values are averaged over both teams
    # receiving the 2H kickoff (grid/checker use this; real plays pass 0/1).
    receive_2h_ko: int | None = 0
    season: int = 2023
    # Real-game team context (internal model inputs, never shown to fans). Defaults = generic
    # what-if: league-average teams and no pregame spread (no-spread WP model).
    convert_shift: float = 0.0  # offense + defense empirical-Bayes shift to P(convert)
    fg_make_shift: float = 0.0  # kicker empirical-Bayes shift to P(make)
    home_spread: float | None = None  # pregame, home side (+ = home favored)

    def __post_init__(self) -> None:
        if not 1 <= self.yardline_100 <= 99:
            raise ValueError("yardline_100 must be 1–99")
        if not 1 <= self.distance <= min(99, self.yardline_100):
            raise ValueError("distance must be 1–yardline_100")
        if not 1 <= self.qtr <= 4:
            raise ValueError("qtr must be 1–4 (regulation)")
        if not 0 <= self.quarter_seconds_remaining <= 900:
            raise ValueError("quarter clock must be 0:00–15:00")
        if not (0 <= self.posteam_timeouts <= 3 and 0 <= self.defteam_timeouts <= 3):
            raise ValueError("timeouts must be 0–3")

    @property
    def game_seconds_remaining(self) -> int:
        return (4 - self.qtr) * 900 + self.quarter_seconds_remaining

    @property
    def half_seconds_remaining(self) -> int:
        return (900 if self.qtr in (1, 3) else 0) + self.quarter_seconds_remaining

    @property
    def kick_distance(self) -> int:
        return self.yardline_100 + FG_SNAP_YARDS

    def available_options(self) -> tuple[Option, ...]:
        opts: list[Option] = ["go"]
        if self.kick_distance <= MAX_FG_DISTANCE:
            opts.append("fg")
        if self.yardline_100 >= PUNT_MIN_YARDLINE_100:
            opts.append("punt")
        return tuple(opts)

    def to_situation(self) -> FourthDownSituation:
        return FourthDownSituation(
            yardline_100=self.yardline_100,
            distance=self.distance,
            score_differential=self.score_differential,
            game_seconds_remaining=self.game_seconds_remaining,
            half_seconds_remaining=self.half_seconds_remaining,
            qtr=self.qtr,
            posteam_timeouts=self.posteam_timeouts,
            defteam_timeouts=self.defteam_timeouts,
            is_home_possession=self.is_home_possession,
            receive_2h_ko=int(self.receive_2h_ko or 0),
            season=self.season,
        )

    @classmethod
    def from_play_row(cls, row: dict[str, Any]) -> "EngineInput":
        """From an nflverse PBP row (4th down, regulation)."""
        def i(k, d=0):
            v = row.get(k)
            return d if v is None or v != v else int(float(v))
        return cls(
            yardline_100=i("yardline_100"),
            distance=i("ydstogo"),
            score_differential=i("score_differential"),
            qtr=i("qtr"),
            quarter_seconds_remaining=i("quarter_seconds_remaining"),
            posteam_timeouts=i("posteam_timeouts_remaining", 3),
            defteam_timeouts=i("defteam_timeouts_remaining", 3),
            is_home_possession=row.get("posteam") == row.get("home_team"),
            receive_2h_ko=i("receive_2h_ko", 0),
            season=i("season", 2023),
        )


@dataclass(frozen=True)
class EngineOutput:
    options: tuple[Option, ...]
    wp: dict[str, float]  # possession team's win chance after each option
    home_wp: dict[str, float]  # same, from the home team's side
    recommendation: Option
    gap_pts: float  # best − second best, in win-chance points (0–100 scale)
    close_call: bool
    kick_distance: int
    engine_version: str = ENGINE_VERSION

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["options"] = list(self.options)
        return d


class FourthDownEngine:
    def __init__(self, analyzer: FourthDownAnalyzer, spread_analyzer: FourthDownAnalyzer | None = None):
        self.analyzer = analyzer
        self.spread_analyzer = spread_analyzer  # used only when a real game's spread is known

    def _raw_wp(self, x: EngineInput) -> dict[str, float]:
        sit = x.to_situation()
        az = self.spread_analyzer if (x.home_spread is not None and self.spread_analyzer) else self.analyzer
        emp = az.empirics
        conv = make = None
        if x.convert_shift:
            conv = emp.p_convert(sit.distance, season=sit.season, mode=EMPIRICS_MODE)[0] + x.convert_shift
        if x.fg_make_shift:
            make = emp.p_make(x.kick_distance, season=sit.season, mode=EMPIRICS_MODE)[0] + x.fg_make_shift
        res = az.analyze(
            sit, empirics_mode=EMPIRICS_MODE, transition_mode=TRANSITION_MODE,
            p_convert_override=conv, p_make_override=make,
            home_spread=x.home_spread if az is self.spread_analyzer else None,
        )
        return {o: float(a.value_wp) for o, a in res.actions.items()}

    def evaluate(self, x: EngineInput) -> EngineOutput:
        if x.receive_2h_ko is None and x.qtr <= 2:
            a = self._raw_wp(replace(x, receive_2h_ko=0))
            b = self._raw_wp(replace(x, receive_2h_ko=1))
            raw = {o: 0.5 * (a[o] + b[o]) for o in a if o in b}
        else:
            raw = self._raw_wp(x)
        opts = tuple(o for o in x.available_options() if o in raw)
        wp = {o: round(raw[o], DECIMALS) for o in opts}
        home = {o: (v if x.is_home_possession else round(1.0 - v, DECIMALS)) for o, v in wp.items()}
        ranked = sorted(opts, key=lambda o: (-wp[o], opts.index(o)))
        gap = round((wp[ranked[0]] - wp[ranked[1]]) * 100, 2) if len(ranked) > 1 else 100.0
        return EngineOutput(
            options=opts,
            wp=wp,
            home_wp=home,
            recommendation=ranked[0],
            gap_pts=gap,
            close_call=gap < CLOSE_CALL_PTS,
            kick_distance=x.kick_distance,
        )


def load_engine(*, with_spread_model: bool = False) -> FourthDownEngine:
    """Generic engine (grid, checker) uses the no-spread model. ``with_spread_model`` adds the
    separate spread model for real games with a known spread (fourth_downs table)."""
    from nfl_sim.api.situation_lab import WP_MODEL_ARTIFACT, _load_analyzer
    from nfl_sim.models.fourth_down import FourthDownAnalyzer
    from nfl_sim.models.wp_model import WP_SPREAD_MODEL_FILE, WPModel

    az = _load_analyzer()
    if az is None:
        raise FileNotFoundError("WP model artifact missing (reports/wp/artifacts/wp_model.joblib)")
    spread_az = None
    if with_spread_model:
        path = WP_MODEL_ARTIFACT.parent / WP_SPREAD_MODEL_FILE
        if not path.exists():
            raise FileNotFoundError(f"{path} missing; run python -m nfl_sim.models wp-train-spread")
        spread_az = FourthDownAnalyzer(WPModel.load(path), az.empirics)
    return FourthDownEngine(az, spread_az)
