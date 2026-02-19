#!/bin/bash
set -u

cd "$(dirname "$0")"

echo "=== Market Catalyst Monitor Launcher ==="
echo "Folder: $(pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed."
  echo "Install with: brew install node"
  read -r -p "Press Enter to close..." _
  exit 1
fi

echo "Node: $(node -v)"
echo "npm: $(npm -v)"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  if ! npm install; then
    echo "npm install failed."
    read -r -p "Press Enter to close..." _
    exit 1
  fi
fi

echo "Starting server at http://127.0.0.1:3000"
(sleep 1; open "http://127.0.0.1:3000" >/dev/null 2>&1 || true) &
HOST=127.0.0.1 PORT=3000 node server.js

CODE=$?
echo "Server exited with code $CODE"
read -r -p "Press Enter to close..." _
exit "$CODE"
EOF && chmod +x "/Users/jamesjoly/Documents/New project/Launch Market Catalyst Monitor.command"