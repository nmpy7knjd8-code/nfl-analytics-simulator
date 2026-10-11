"""Phase 3 Stage A — independent EP model and deterministic EPA; WP prototype."""

from nfl_sim.models.constants import EP_CLASS_VALUES, EP_CLASSES
from nfl_sim.models.epa import compute_epa
from nfl_sim.models.ep_model import EPModel
from nfl_sim.models.split import forbid_test_season_in_fit
from nfl_sim.models.wp_model import WPModel

__all__ = [
    "EP_CLASSES",
    "EP_CLASS_VALUES",
    "EPModel",
    "WPModel",
    "compute_epa",
    "forbid_test_season_in_fit",
]
