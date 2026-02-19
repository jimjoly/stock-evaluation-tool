#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Market Catalyst Monitor at http://127.0.0.1:3000"
open "http://127.0.0.1:3000" || true
HOST=127.0.0.1 PORT=3000 npm start
