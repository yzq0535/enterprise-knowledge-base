#!/bin/bash
# 个人知识库启动脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 检查 Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ 未检测到 Python3，请先安装 Python 3.8+"
    exit 1
fi

# 检查并安装依赖
if ! python3 -c "import flask" &> /dev/null; then
    echo "📦 正在安装依赖..."
    pip3 install -r requirements.txt --break-system-packages
fi

echo "=================================================="
echo "  📚 个人知识库已启动"
echo "  🌐 访问地址: http://127.0.0.1:5000"
echo "  按 Ctrl+C 停止服务"
echo "=================================================="

python3 app.py
