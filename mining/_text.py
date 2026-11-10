"""Small fan-text fixes shared by site JSON builders (checked by backend/tests/test_data_audit.py)."""
from __future__ import annotations

import re

_DOUBLED_PERIOD = re.compile(r"(?<!\.)\.\.(?!\.)")


def fix_doubled_period(s: str) -> str:
    """'Chris Godwin Jr..' -> 'Chris Godwin Jr.' (an abbreviation followed by the sentence's period). '...' is kept."""
    return _DOUBLED_PERIOD.sub(".", s)
