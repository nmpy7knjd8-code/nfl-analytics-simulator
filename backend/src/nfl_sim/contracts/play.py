from pydantic import BaseModel, Field

from .enums import PlayType


class ReferenceModelColumns(BaseModel):
    """Published nflfastR / nflverse model outputs — reference only, not observed state."""

    ep: float | None = None
    epa: float | None = None
    wp: float | None = None
    wpa: float | None = None
    vegas_wp: float | None = None
    vegas_wpa: float | None = None
    home_wp: float | None = None
    away_wp: float | None = None
    cp: float | None = None
    success: float | None = None


class CanonicalPlay(BaseModel):
    """Observed play / post-play reconstruction row (DATA_EXPERIMENT §3.3)."""

    play_id: str
    game_id: str
    play_index: int = Field(ge=0)
    # Pre-play snapshot (observed)
    quarter: int = Field(ge=1, le=5)
    half_seconds_remaining: int | None = None
    game_seconds_remaining: int | None = None
    down: int | None = Field(default=None, ge=1, le=4)
    distance: int | None = None
    yardline_100: int | None = Field(default=None, ge=0, le=100)
    possession_team_id: str | None = None
    defense_team_id: str | None = None
    is_home_possession: bool | None = None
    score_differential: int | None = None
    posteam_score: int | None = None
    defteam_score: int | None = None
    posteam_timeouts: int | None = None
    defteam_timeouts: int | None = None
    roof: str | None = None
    receive_2h_ko: int | None = Field(default=None, ge=0, le=1)
    # Post-play observed
    play_type: PlayType
    description: str | None = None
    yards_gained: float | None = None
    score_differential_post: int | None = None
    posteam_score_post: int | None = None
    defteam_score_post: int | None = None
    fixed_drive: int | None = None
    fixed_drive_result: str | None = None
    is_scoring_play: bool = False
    is_turnover: bool = False
    # Namespaced reference model columns (never silent features)
    reference: ReferenceModelColumns = Field(default_factory=ReferenceModelColumns)
