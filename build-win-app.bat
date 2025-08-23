@echo off
REM build-win-app.bat - 构建Windows应用程序的批处理脚本

echo =======================================
echo      Vursor Windows 应用构建脚本
echo =======================================

REM 检查Node.js环境
echo.
echo [1/7] 检查Node.js环境...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo 错误: Node.js 未安装，请先安装 Node.js
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo Node.js版本: %NODE_VERSION%

REM 检查npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo 错误: npm 未安装，请先安装 npm
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo npm版本: %NPM_VERSION%

REM 安装依赖
echo.
echo [2/7] 安装项目依赖...
call npm install
if %ERRORLEVEL% neq 0 (
    echo 错误: 依赖安装失败
    exit /b 1
)

REM 清理旧的构建文件
echo.
echo [3/7] 清理旧的构建文件...
if exist dist rmdir /s /q dist
if exist release rmdir /s /q release

REM 生成图标
echo.
echo [4/7] 生成应用图标...
if exist scripts\generate-icons.js (
    call npm run generate-icons
    if %ERRORLEVEL% neq 0 (
        echo 警告: 图标生成失败，但将继续构建
    )
) else (
    echo 警告: 图标生成脚本不存在，跳过此步骤
)

REM 构建前端代码
echo.
echo [5/7] 构建React前端代码...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo 错误: 前端构建失败
    exit /b 1
)

REM 构建Electron应用
echo.
echo [6/7] 构建Electron Windows应用...
call npx electron-builder --win --x64
if %ERRORLEVEL% neq 0 (
    echo 错误: Electron构建失败
    exit /b 1
)

REM 检查构建结果
echo.
echo [7/7] 检查构建结果...
if exist release (
    echo 构建成功! Windows应用程序已创建:
    dir /b release\*.exe release\*portable*.* 2>nul
    if %ERRORLEVEL% neq 0 (
        echo 警告: 未找到Windows可执行文件，请检查release目录
    )
) else (
    echo 错误: 构建失败，release目录不存在
    exit /b 1
)

echo.
echo =======================================
echo      构建完成!
echo =======================================

pause