#!/bin/bash
set -e

echo "Starting Shellius in development mode..."

# Start PostgreSQL via Docker
docker compose up -d postgres

# Start cloud server
echo "Starting cloud server..."
cd cloud && go run ./cmd/server &
CLOUD_PID=$!

# Start backend
echo "Starting local backend..."
cd ../backend && go run ./cmd/shellius &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

# Cleanup on exit
trap "kill $CLOUD_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo "All services started."
echo "  Frontend: http://localhost:5173"
echo "  Backend WS: ws://localhost:9800/ws"
echo "  Cloud API: http://localhost:8080"

wait
