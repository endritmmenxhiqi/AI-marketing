#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

install_linux() {
  sudo apt-get update
  sudo apt-get install -y ffmpeg redis-server
}

install_macos() {
  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is required on macOS."
    exit 1
  fi

  brew install ffmpeg redis
}

case "$(uname -s)" in
  Linux*)
    install_linux
    ;;
  Darwin*)
    install_macos
    ;;
  *)
    echo "setup.sh currently supports Linux and macOS. On Windows, install FFmpeg and Redis manually or use Docker."
    ;;
esac

cd "$ROOT_DIR"
npm install
npm install --workspace backend
npm install --workspace frontend

mkdir -p backend/storage/uploads backend/storage/work backend/storage/cache backend/storage/exports

echo ""
echo "Setup complete."
echo "Next steps:"
echo "1. Copy backend/.env.example to backend/.env and fill in your API keys."
echo "2. Copy frontend/.env.example to frontend/.env."
echo "3. Start MongoDB + Redis with: docker compose up -d mongodb redis"
echo "4. Run backend: npm run dev --workspace backend"
echo "5. Run worker: npm run worker:dev --workspace backend"
echo "6. Run frontend: npm run dev --workspace frontend"
