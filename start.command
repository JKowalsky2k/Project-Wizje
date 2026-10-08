#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Nie znaleziono Python 3. Zainstaluj go i uruchom ten plik ponownie."
  read -r -p "Naciśnij Enter, aby zamknąć..."
  exit 1
fi

echo "Uruchamiam stronę i panel Wizje..."
echo "Panel: http://localhost:8000/admin"
sleep 1
open "http://localhost:8000/admin"
exec python3 tools/collections.py --serve --port 8000
