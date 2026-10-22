#!/usr/bin/env bash
set -e

COMMAND=${1:-help}

start() {
  echo "Starting SimpleFund..."

  trap 'echo "Shutting down..."; kill $(jobs -p) 2>/dev/null; exit 0' INT TERM

  (cd backend && uv run fastapi dev app/main.py) &
  (cd frontend && npm run dev) &

  wait
}

case "$COMMAND" in
  up) start ;;
  *)
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  up    Start frontend and backend"
    ;;
esac
