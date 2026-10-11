"""Live / pre-snap adapter boundary.

Historical lake path must not depend on providers. This package holds the
fixture/demo pre-snap adapter and recorded-frame demo sequence — no real
live vendor in this stage.
"""

from nfl_sim.providers.pre_snap import (
    PreSnapAdapterError,
    list_fixtures,
    load_fixture,
    parse_pre_snap_snapshot,
    snapshot_to_decision_row,
)
from nfl_sim.providers.recorded_demo import (
    advance_index,
    get_frame,
    list_sequences,
    load_sequence,
    sequence_summary,
)

__all__ = [
    "PreSnapAdapterError",
    "advance_index",
    "get_frame",
    "list_fixtures",
    "list_sequences",
    "load_fixture",
    "load_sequence",
    "parse_pre_snap_snapshot",
    "sequence_summary",
    "snapshot_to_decision_row",
]
