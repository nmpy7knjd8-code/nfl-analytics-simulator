"""Pre-play state is modeled as GameSituation (frozen inputs before a play).

Post-play observations are CanonicalPlay. Keep these types distinct in APIs:
do not mutate historical CanonicalPlay rows with counterfactual outcomes.
"""

from .situation import GameSituation as PrePlayState

__all__ = ["PrePlayState"]
