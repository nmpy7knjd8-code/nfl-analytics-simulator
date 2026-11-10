"""Self-host team logos and wordmarks (no runtime hotlinking).

Reads nflverse teams (nflreadpy.load_teams), keeps the 32 current teams (the abbreviations in
frontend/lib/teamColors.json), downloads team_logo_espn and team_wordmark, shrinks them and writes:
  frontend/public/teams/<ABBR>/logo.png, wordmark.png
  frontend/public/teams/manifest.json   (+ copy at frontend/contracts/teamLogos.json)

    python backend/scripts/fetch_team_logos.py      # needs network, nflreadpy, Pillow
"""
from __future__ import annotations

import datetime as dt
import io
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend/public/teams"
CONTRACT_COPY = ROOT / "frontend/contracts/teamLogos.json"
LOGO_PX = 256          # logos are square 500px on ESPN; 256 covers 2x at 128px display
WORDMARK_W = 600       # wordmarks are wide; cap width
SOURCE = ("Team data from nflverse (nflreadpy load_teams). Logos: ESPN (team_logo_espn); wordmarks: nflverse "
          "(team_wordmark). Downloaded and self-hosted by backend/scripts/fetch_team_logos.py; trademarks of the NFL "
          "and its teams, used for identification only.")


def current_teams() -> list[str]:
    return sorted(json.loads((ROOT / "frontend/lib/teamColors.json").read_text())["teams"])


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "nfl-analytics-simulator/fetch_team_logos"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def shrink_png(data: bytes, max_w: int, max_h: int) -> bytes:
    from PIL import Image
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    im.thumbnail((max_w, max_h), Image.LANCZOS)
    # palette PNG with alpha: logos are flat colour, so 256 colours is visually lossless
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    buf = io.BytesIO()
    q.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def main() -> None:
    import nflreadpy as nfl

    teams = nfl.load_teams().to_pandas().set_index("team_abbr")
    want = current_teams()
    missing = [t for t in want if t not in teams.index]
    if missing:
        sys.exit(f"nflverse teams missing {missing}")
    manifest = {"_source": SOURCE, "fetched": dt.date.today().isoformat(), "teams": {}}
    for abbr in want:
        row = teams.loc[abbr]
        d = OUT / abbr
        d.mkdir(parents=True, exist_ok=True)
        entry = {}
        for kind, col, box in (("logo", "team_logo_espn", (LOGO_PX, LOGO_PX)), ("wordmark", "team_wordmark", (WORDMARK_W, WORDMARK_W))):
            url = row[col]
            png = shrink_png(_get(url), *box)
            (d / f"{kind}.png").write_bytes(png)
            entry[kind] = {"path": f"/teams/{abbr}/{kind}.png", "source_url": url, "bytes": len(png)}
        manifest["teams"][abbr] = entry
    text = json.dumps(manifest, indent=2) + "\n"
    (OUT / "manifest.json").write_text(text)
    CONTRACT_COPY.write_text(text)
    total = sum(e[k]["bytes"] for e in manifest["teams"].values() for k in ("logo", "wordmark"))
    print(f"{len(want)} teams, {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
