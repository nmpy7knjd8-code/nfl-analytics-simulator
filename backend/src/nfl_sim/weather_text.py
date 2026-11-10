"""Wind (mph) and temperature (F) from nflverse play-by-play's free-text ``weather`` field (W4, 2026-11-10).

Fallback only: used when nflverse's numeric ``wind`` / ``temp`` are missing for an open-air game
(roof outdoors/open). Shared by products/games.py (game files, season indexes) and
mining/build_weather.py (weather.json) so both read the same numbers.

    "Sunny Temp: 71° F, Humidity: 87%, Wind: West 3 mph" -> (3, 71)

Returns None unless both numbers parse cleanly. Text that says "Indoors" (conflicts with an open-air
roof) or a wind of "N/A" is not used; a reading with one number only is not used either.
"""
from __future__ import annotations

import re

_TEMP = re.compile(r"\bTemp:\s*(-?\d{1,3})\s*°\s*F\b", re.I)
_WIND = re.compile(r"\bWind:\s*(?:[A-Za-z]{1,10}\s+)?(\d{1,2})\s*mph\b", re.I)


def parse_weather_text(text: object) -> tuple[int, int] | None:
    """(wind_mph, temp_f) or None."""
    if not isinstance(text, str) or not text.strip():
        return None
    if re.search(r"\bindoors?\b", text, re.I) or re.search(r"\bWind:\s*N/?A\b", text, re.I):
        return None
    t, w = _TEMP.search(text), _WIND.search(text)
    if not t or not w:
        return None
    return int(w.group(1)), int(t.group(1))
