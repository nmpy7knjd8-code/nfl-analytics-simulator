from enum import Enum

from pydantic import BaseModel, Field

from .enums import TruthLabel


class ModelStage(str, Enum):
    A = "A"
    B = "B"
    C = "C"


class ModelKind(str, Enum):
    EP = "ep"
    EPA = "epa"
    WP = "wp"
    CP = "cp"
    FOURTH_DOWN = "fourth_down"
    PLAY_TRANSITION = "play_transition"
    MONTE_CARLO = "monte_carlo"


class ModelDescriptor(BaseModel):
    id: str
    name: str
    kind: ModelKind
    stage: ModelStage
    version: str
    truth_label_default: TruthLabel
    description: str
    calibrated: bool = False
    references: list[str] = Field(default_factory=list)


class EpEpaBaselineResult(BaseModel):
    ep: float
    epa: float | None = None
    source: str  # nflfastr_column | stage_a_table | unavailable
    model_id: str
    model_version: str
