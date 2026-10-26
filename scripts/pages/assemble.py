#!/usr/bin/env python3
"""Assemble the GitHub Pages site into _site/.

The Next.js static export (frontend/out, basePath /nfl-analytics-simulator) is the
site root. Static files from docs/ (favicon, docs pages) are copied first; the
old hand-written landing page, the committed docs/demo export and the
docs/{quiz,games,decide} redirect stubs are not shipped (the app owns those routes).
Old links keep working through static redirect pages (Pages has no server redirects).
"""
from __future__ import annotations

import html
import shutil
import sys
from pathlib import Path

BASE = "/nfl-analytics-simulator/"
ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
OUT = ROOT / "frontend" / "out"
SITE = ROOT / "_site"

SKIP_FROM_DOCS = {"demo", "index.html", "quiz", "games", "decide", "404.html"}

# old path (relative to BASE) -> new path (relative to BASE)
STATIC_REDIRECTS = {
    "demo/": "",
    "demo/quiz/": "daily/",
    "quiz/": "daily/",
    "demo/decide/": "fourth-down/",
    "decide/": "fourth-down/",
    "demo/games/": "games/",
}
# Game ids that changed (brief C2). Only written when the target page exists.
GAME_ID_MOVES = {"2023_02_BUF_NYJ": "2023_01_BUF_NYJ"}

SPA_404_SCRIPT = """<script>
(function () {
  var base = "%s", p = location.pathname;
  if (p.indexOf(base) !== 0) return;
  var r = p.slice(base.length), n = r;
  n = n.replace(/^demo(\\/|$)/, "");
  n = n.replace(/^quiz(\\/|$)/, "daily$1").replace(/^decide(\\/|$)/, "fourth-down$1");
  n = n.replace(/^games\\/2023_02_BUF_NYJ(\\/|$)/, "games/2023_01_BUF_NYJ$1");
  if (n !== r) location.replace(base + n + location.search + location.hash);
})();
</script>""" % BASE


def redirect_html(target: str) -> str:
    url = html.escape(BASE + target, quote=True)
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>Redirecting…</title>
<link rel="canonical" href="{url}" />
<meta name="robots" content="noindex" />
<meta http-equiv="refresh" content="0; url={url}" />
<link rel="icon" href="{BASE}favicon.svg" type="image/svg+xml" />
<script>location.replace("{url}" + location.search + location.hash);</script>
</head><body><p>This page moved to <a href="{url}">{url}</a>.</p></body></html>
"""


def write_redirect(old: str, new: str) -> None:
    dest = SITE / old / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(redirect_html(new))
    print(f"redirect /{old} -> /{new}")


def main() -> int:
    if not (OUT / "index.html").exists():
        print("frontend/out missing; run `npm run build:pages` first", file=sys.stderr)
        return 1
    shutil.rmtree(SITE, ignore_errors=True)
    SITE.mkdir()
    for item in DOCS.iterdir():
        if item.name in SKIP_FROM_DOCS:
            continue
        dst = SITE / item.name
        if item.is_dir():
            shutil.copytree(item, dst)
        else:
            shutil.copy2(item, dst)
    shutil.copytree(OUT, SITE, dirs_exist_ok=True)

    for old, new in STATIC_REDIRECTS.items():
        write_redirect(old, new)

    games = SITE / "games"
    ids = sorted(p.name for p in games.iterdir() if p.is_dir()) if games.exists() else []
    for gid in ids:
        write_redirect(f"demo/games/{gid}/", f"games/{gid}/")
    for old_id, new_id in GAME_ID_MOVES.items():
        if (games / new_id / "index.html").exists():
            write_redirect(f"demo/games/{old_id}/", f"games/{new_id}/")
            if not (games / old_id).exists():
                write_redirect(f"games/{old_id}/", f"games/{new_id}/")
        else:
            print(f"skip game-id redirect {old_id} -> {new_id}: target not built yet")

    nf = SITE / "404.html"
    text = nf.read_text()
    nf.write_text(text.replace("</head>", SPA_404_SCRIPT + "</head>", 1))
    (SITE / ".nojekyll").touch()
    return 0


if __name__ == "__main__":
    sys.exit(main())
