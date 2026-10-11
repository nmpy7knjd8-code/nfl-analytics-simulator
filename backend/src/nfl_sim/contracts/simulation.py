from enum import Enum

from pydantic import BaseModel, Field

from .enums import DecisionAction, TruthLabel
from .provenance import Provenance
from .situation import GameSituation


class SimulationScope(str, Enum):
    PLAY = "play"
    DRIVE = "drive"
    GAME = "game"


class SimulationRequest(BaseModel):
    """Initial simulation request contract — no outcome logic."""

    situation: GameSituation
    scope: SimulationScope = SimulationScope.DRIVE
    n_paths: int = Field(default=1000, ge=1, le=50_000)
    seed: int
    forced_action: DecisionAction | None = None
    model_id: str = "mc-play-transition-v1"
    label: TruthLabel = TruthLabel.COUNTERFACTUAL


class OutcomeBucket(BaseModel):
    key: str
    count: int = Field(ge=0)
    share: float = Field(ge=0.0, le=1.0)


class SimulationResult(BaseModel):
    """Initial simulation result contract — populated by Phase 4+ engine."""

    request: SimulationRequest
    provenance: Provenance
    summary: dict[str, float]
    distributions: dict[str, list[OutcomeBucket]]
    sample_paths: list[dict] = Field(default_factory=list, max_length=25)
