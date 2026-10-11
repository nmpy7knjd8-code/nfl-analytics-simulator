from enum import Enum


class League(str, Enum):
    """Reserved for later; product scope is NFL-only."""

    NFL = "NFL"


class TruthLabel(str, Enum):
    HISTORICAL = "historical"
    PREDICTED = "predicted"
    COUNTERFACTUAL = "counterfactual"


class DataMode(str, Enum):
    HISTORICAL = "historical"
    LIVE = "live"
    DEMO = "demo"


class PlayType(str, Enum):
    PASS = "pass"
    RUSH = "rush"
    PUNT = "punt"
    FIELD_GOAL = "field_goal"
    KICKOFF = "kickoff"
    EXTRA_POINT = "extra_point"
    TWO_POINT = "two_point"
    NO_PLAY = "no_play"
    OTHER = "other"


class DecisionAction(str, Enum):
    GO_FOR_IT = "go_for_it"
    PUNT = "punt"
    FIELD_GOAL = "field_goal"
    RUN = "run"
    PASS = "pass"
    KNEEL = "kneel"
    SPIKE = "spike"
