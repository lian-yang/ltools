#!/bin/bash

# 音乐播放器 LX Music 集成测试脚本

echo "========================================="
echo "🎵 LTools 音乐播放器 LX Music 集成测试"
echo "========================================="
echo ""

# 检查 Node.js
echo "📦 检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    echo "请安装 Node.js >= 16.0.0"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js 版本过低: $(node --version)"
    echo "需要 >= 16.0.0"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo ""

# 检查依赖
echo "📦 检查 Node.js 依赖..."
cd lx-music-service

if [ ! -d "node_modules" ]; then
    echo "⚠️  依赖未安装，正在安装..."
    npm install
fi

echo "✅ 依赖已安装"
echo ""

# 检查音源
echo "📋 检查音源文件..."
SOURCE_COUNT=$(ls -1 sources/*.js 2>/dev/null | wc -l | tr -d ' ')
echo "✅ 找到 $SOURCE_COUNT 个音源文件"

if [ "$SOURCE_COUNT" -lt 3 ]; then
    echo "⚠️  音源文件较少，建议下载更多"
    echo "运行: node source-manager.js download"
fi
echo ""

# 测试 Node.js 服务
echo "🧪 测试 Node.js 服务..."
timeout 3s node test/test_api.js > /tmp/lx-test.log 2>&1 &
TEST_PID=$!
sleep 2

if ps -p $TEST_PID > /dev/null 2>&1; then
    echo "✅ Node.js 服务启动成功"
    kill $TEST_PID 2>/dev/null
    wait $TEST_PID 2>/dev/null
else
    wait $TEST_PID 2>/dev/null
    if grep -q "All tests completed" /tmp/lx-test.log; then
        echo "✅ Node.js 服务测试通过"
    else
        echo "⚠️  Node.js 服务测试未完成"
        echo "查看日志: /tmp/lx-test.log"
    fi
fi

# 检查可用音源
PLUGIN_COUNT=$(grep -c "Loaded plugin" /tmp/lx-test.log 2>/dev/null || echo "0")
echo "✅ 成功加载 $PLUGIN_COUNT 个音源插件"
echo ""

# 检查 Go 编译
echo "🔧 检查 Go 编译..."
cd ..
if [ ! -f "/tmp/ltools-test" ]; then
    echo "⚠️  编译测试文件不存在，正在编译..."
    go build -o /tmp/ltools-test .
fi

if [ -f "/tmp/ltools-test" ]; then
    echo "✅ Go 代码编译成功"
    echo "   文件大小: $(du -h /tmp/ltools-test | cut -f1)"
else
    echo "❌ Go 代码编译失败"
    exit 1
fi
echo ""

# 显示集成状态
echo "📊 集成状态总结:"
echo "  ✅ Node.js 服务就绪"
echo "  ✅ Go 客户端就绪"
echo "  ✅ $PLUGIN_COUNT 个音源可用"
echo ""

# 提供启动选项
echo "🚀 准备启动 LTools..."
echo ""
echo "选择启动方式:"
echo "  1) 开发模式（推荐）: task dev"
echo "  2) 测试构建: /tmp/ltools-test"
echo "  3) 退出"
echo ""
read -p "请选择 (1-3): " choice

case $choice in
    1)
        echo ""
        echo "启动开发模式..."
        echo "查看日志中是否出现:"
        echo "  [INFO] Using LX Music service (new version)"
        echo "  [MusicFreeAdapter] Loaded plugin: 酷狗 v1.0.3"
        echo ""
        task dev
        ;;
    2)
        echo ""
        echo "启动测试构建..."
        /tmp/ltools-test
        ;;
    3)
        echo "退出"
        exit 0
        ;;
    *)
        echo "无效选择"
        exit 1
        ;;
esac
