#!/bin/bash
# Runs the LLM Council server. Used by the macOS login agent, which starts this
# automatically so you don't need a terminal open.
#
# It serves both the API and the built frontend at http://localhost:8001

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$(dirname "$0")" || exit 1

exec uv run python -m backend.main
