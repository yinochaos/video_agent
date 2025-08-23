#!/bin/bash
# build-win-app.sh - 构建Windows应用程序的脚本

# 设置错误时退出
set -e

# 显示彩色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 显示脚本标题
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}     Vursor Windows 应用构建脚本      ${NC}"
echo -e "${GREEN}=======================================${NC}"

# 检查Node.js环境
echo -e "\n${YELLOW}[1/7]${NC} 检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: Node.js 未安装，请先安装 Node.js${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "Node.js版本: ${GREEN}$NODE_VERSION${NC}"

# 检查npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: npm 未安装，请先安装 npm${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "npm版本: ${GREEN}$NPM_VERSION${NC}"

# 安装依赖
echo -e "\n${YELLOW}[2/7]${NC} 安装项目依赖..."
npm install

# 清理旧的构建文件
echo -e "\n${YELLOW}[3/7]${NC} 清理旧的构建文件..."
rm -rf dist release

# 生成图标
echo -e "\n${YELLOW}[4/7]${NC} 生成应用图标..."
if [ -f "scripts/generate-icons.js" ]; then
    npm run generate-icons
else
    echo -e "${YELLOW}警告: 图标生成脚本不存在，跳过此步骤${NC}"
fi

# 构建前端代码
echo -e "\n${YELLOW}[5/7]${NC} 构建React前端代码..."
npm run build

# 构建Electron应用
echo -e "\n${YELLOW}[6/7]${NC} 构建Electron Windows应用..."
# 只构建Windows版本
npx electron-builder --win --x64

# 检查构建结果
echo -e "\n${YELLOW}[7/7]${NC} 检查构建结果..."
if [ -d "release" ]; then
    WIN_FILES=$(ls -1 release | grep -i '\.exe\|\.msi\|\.appx\|portable')
    WIN_COUNT=$(echo "$WIN_FILES" | wc -l)
    
    if [ "$WIN_COUNT" -gt 0 ]; then
        echo -e "${GREEN}构建成功! Windows应用程序已创建:${NC}"
        echo "$WIN_FILES" | while read -r file; do
            echo -e "  - ${GREEN}release/$file${NC}"
        done
    else
        echo -e "${RED}构建可能失败，未找到Windows可执行文件${NC}"
    fi
else
    echo -e "${RED}构建失败，release目录不存在${NC}"
    exit 1
fi

echo -e "\n${GREEN}=======================================${NC}"
echo -e "${GREEN}     构建完成!                         ${NC}"
echo -e "${GREEN}=======================================${NC}"