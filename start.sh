#!/bin/bash

# LLM Council - Start script

# uv installs itself here. This script runs under bash, which doesn't read the
# zsh profile, so add it to PATH ourselves.
export PATH="$HOME/.local/bin:$PATH"

if ! command -v uv > /dev/null; then
  echo "uv is not installed. Install it with:"
  echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

# The always-on login agent already owns port 8001. Running both would fail.
if lsof -nP -iTCP:8001 -sTCP:LISTEN > /dev/null 2>&1; then
  echo "Port 8001 is already in use, probably the always-on server."
  echo "It is already running at http://localhost:8001 - just open that."
  echo ""
  echo "To stop it and use this dev script instead:"
  echo "  launchctl bootout gui/$(id -u)/com.aidenkaro.llmcouncil"
  exit 1
fi

echo "Starting LLM Council..."
echo ""

# Start backend
echo "Starting backend on http://localhost:8001..."
uv run python -m backend.main &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "Starting frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ LLM Council is running!"
echo "  Backend:  http://localhost:8001"
echo "  Frontend: see the 'Local:' line printed by Vite above"
echo "            (usually 5173, or 5174 if another app already has 5173)"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
