#!/usr/bin/env bash
# Starts the whole app: backend (FastAPI, port 8001) and frontend (Vite, port 5174).  Usage: ./start.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -x .venv/bin/uvicorn ] || { echo "Missing .venv. Run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"; exit 1; }
[ -d frontend/node_modules ] || (cd frontend && npm install)
trap 'kill 0' EXIT
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 &
(cd frontend && npm run dev) &
echo "Backend  http://localhost:8001/docs"; echo "Frontend http://localhost:5174"
wait
