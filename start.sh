#!/bin/bash
# Start Proxy — both backend and frontend

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Proxy backend..."
cd "$ROOT/backend"
source venv/bin/activate
uvicorn main:app --reload \
  --reload-dir "$ROOT/backend/agents" \
  --reload-dir "$ROOT/backend/routers" \
  --reload-dir "$ROOT/backend/services" \
  --reload-dir "$ROOT/backend/models" \
  --reload-dir "$ROOT/backend/memory" \
  --reload-include "*.py" \
  --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "🎨 Starting Proxy frontend..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Proxy is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
