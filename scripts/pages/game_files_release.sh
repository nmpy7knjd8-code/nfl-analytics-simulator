#!/usr/bin/env bash
# Game files (frontend/public/data/games/{id}.json, game.v2) via a GitHub release asset.
# PREPARED ONLY: no release exists yet. Creating/publishing one needs owner approval.
#
#   pack:      scripts/pages/game_files_release.sh pack      -> dist/games-v2.tar.gz + .sha256 (local)
#   fetch:     GAMES_RELEASE_TAG=<tag> scripts/pages/game_files_release.sh fetch
#              (Pages build; no-op when GAMES_RELEASE_TAG is empty, so committed files are used)
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR=frontend/public/data/games
ASSET=games-v2.tar.gz
case "${1:-}" in
  pack)
    mkdir -p dist
    tar -czf "dist/$ASSET" -C "$DIR" $(cd "$DIR" && ls 20??_*_*.json)
    (cd dist && sha256sum "$ASSET" > "$ASSET.sha256")
    ls -la "dist/$ASSET"; cat "dist/$ASSET.sha256" ;;
  fetch)
    if [ -z "${GAMES_RELEASE_TAG:-}" ]; then echo "GAMES_RELEASE_TAG unset: using committed game files"; exit 0; fi
    mkdir -p dist
    gh release download "$GAMES_RELEASE_TAG" -p "$ASSET" -p "$ASSET.sha256" -D dist --clobber
    (cd dist && sha256sum -c "$ASSET.sha256")
    tar -xzf "dist/$ASSET" -C "$DIR"
    n=$(ls "$DIR"/20??_*_*.json | wc -l); echo "game files: $n"; [ "$n" -ge 1900 ] ;;
  *) echo "usage: $0 pack|fetch" >&2; exit 2 ;;
esac
