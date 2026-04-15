#!/usr/bin/env bash
# run.sh — Quick start script for ClassicModels Dashboard

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════════╗"
echo "║   ClassicModels Analytics Dashboard      ║"
echo "╚══════════════════════════════════════════╝"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "❌ Python3 không tìm thấy!"
  exit 1
fi

# Virtual env
if [ ! -d ".venv" ]; then
  echo "📦 Tạo virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "📦 Cài đặt dependencies..."
pip install -q -r requirements.txt

echo ""
echo "🚀 Khởi động server tại http://localhost:5000"
echo "   Nhấn Ctrl+C để dừng"
echo ""

python3 -m backend.app
