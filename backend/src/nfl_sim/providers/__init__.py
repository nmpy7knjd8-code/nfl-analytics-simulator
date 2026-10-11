"""Live / pre-snap adapter boundary.

Historical lake path must not depend on providers. This package holds the
fixture/demo pre-snap adapter only — no real live vendor in this stage.
"""

from nfl_sim.providers.pre_snap import (
    PreSnapAdapterError,
    list_fixtures,
    load_fixture,
    parse_pre_snap_snapshot,
    snapshot_to_decision_row,
)

__all__ = [
    "PreSnapAdapterError",
    "list_fixtures",
    "load_fixture",
    "parse_pre_snap_snapshot",
    "snapshot_to_decision_row",
]
