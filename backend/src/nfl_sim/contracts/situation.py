from pydantic import BaseModel, Field


class GameSituation(BaseModel):
    """Frozen pre-play state (inputs only). No outcome logic.

    Aligns with DATA_EXPERIMENT §3.2. Reference model scores (ep/wp) are
    optional and never treated as observed state.
    """

    game_id: str
    play_id: str | None = None
    season: int
    week: int
    season_type: str = "REG"
    possession_team_id: str
    defense_team_id: str
    home_team_id: str
    away_team_id: str
    is_home_possession: bool
    down: int = Field(ge=1, le=4)
    distance: int = Field(ge=0)
    yardline_100: int = Field(ge=1, le=99)
    quarter: int = Field(ge=1, le=5)
    half_seconds_remaining: int = Field(ge=0)
    game_seconds_remaining: int = Field(ge=0)
    score_differential: int = Field(description="posteam − defteam at snap")
    posteam_score: int
    defteam_score: int
    posteam_timeouts: int = Field(ge=0, le=3)
    defteam_timeouts: int = Field(ge=0, le=3)
    roof: str | None = None
    receive_2h_ko: int = Field(
        ge=0,
        le=1,
        description="Derived (not in nflverse Parquet); nflfastR-compatible",
    )
    # Optional attached reference snapshots — not features by default
    reference_ep: float | None = None
    reference_wp: float | None = None
