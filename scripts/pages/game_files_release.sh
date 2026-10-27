#!/usr/bin/env bash
# Game files (frontend/public/data/games/{id}.json, game.v2) via a GitHub release asset.
# Not tracked in git (.gitignore). Expected sha256 is pinned in scripts/pages/<asset>.sha256.
#
#   pack:      GAMES_RELEASE_TAG=<tag> scripts/pages/game_files_release.sh pack -> dist/<tag>.tar.gz + .sha256 (local)
#   fetch:     GAMES_RELEASE_TAG=<tag> scripts/pages/game_files_release.sh fetch
#              (Pages build and local dev; fails on missing tag or sha256 mismatch)
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR=frontend/public/data/games
ASSET="${GAMES_RELEASE_TAG:-games-v3}.tar.gz"  # asset name follows the tag
case "${1:-}" in
  pack)
    mkdir -p dist
    tar -czf "dist/$ASSET" -C "$DIR" $(cd "$DIR" && ls 20??_*_*.json)
    (cd dist && sha256sum "$ASSET" > "$ASSET.sha256")
    ls -la "dist/$ASSET"; cat "dist/$ASSET.sha256" ;;
  fetch)
    : "${GAMES_RELEASE_TAG:?GAMES_RELEASE_TAG must be set (e.g. games-v2)}"
    PIN="scripts/pages/$ASSET.sha256"
    [ -s "$PIN" ] || { echo "missing pinned checksum $PIN" >&2; exit 1; }
    mkdir -p dist "$DIR"
    gh release download "$GAMES_RELEASE_TAG" -p "$ASSET" -D dist --clobber
    cp "$PIN" "dist/$ASSET.sha256"
    (cd dist && sha256sum -c "$ASSET.sha256") || { echo "sha256 mismatch for $ASSET" >&2; exit 1; }
    tar -xzf "dist/$ASSET" -C "$DIR"
    n=$(ls "$DIR"/20??_*_*.json | wc -l); echo "game files: $n"; [ "$n" -ge 1900 ] ;;
  *) echo "usage: $0 pack|fetch" >&2; exit 2 ;;
esac
