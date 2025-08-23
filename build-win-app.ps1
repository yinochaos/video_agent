# build-win-app.ps1 - 构建Windows应用程序的PowerShell脚本

# 设置错误处理
$ErrorActionPreference = "Stop"

# 脚本开始
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Show-Header {
    Write-ColorOutput Green "======================================="
    Write-ColorOutput Green "     Vursor Windows 应用构建脚本      "
    Write-ColorOutput Green "======================================="
}

function Show-Step {
    param (
        [string]$step,
        [string]$description
    )
    Write-Host "`n[$step] " -ForegroundColor Yellow -NoNewline
    Write-Host "$description"
}

function Test-CommandExists {
    param (
        [string]$command
    )
    $exists = $null -ne (Get-Command $command -ErrorAction SilentlyContinue)
    return $exists
}

# 显示标题
Show-Header

# 步骤1: 检查环境
Show-Step "1/8" "检查系统环境..."

# 检查Node.js
if (-not (Test-CommandExists "node")) {
    Write-ColorOutput Red "错误: Node.js 未安装，请先安装 Node.js"
    exit 1
}

$nodeVersion = (node -v)
Write-Host "Node.js版本: " -NoNewline
Write-ColorOutput Green $nodeVersion

# 检查npm
if (-not (Test-CommandExists "npm")) {
    Write-ColorOutput Red "错误: npm 未安装，请先安装 npm"
    exit 1
}

$npmVersion = (npm -v)
Write-Host "npm版本: " -NoNewline
Write-ColorOutput Green $npmVersion

# 步骤2: 检查项目文件
Show-Step "2/8" "检查项目文件..."

if (-not (Test-Path "package.json")) {
    Write-ColorOutput Red "错误: package.json 文件不存在，请确保在正确的项目目录中运行此脚本"
    exit 1
}

# 检查electron-builder配置
$packageJson = Get-Content -Raw -Path "package.json" | ConvertFrom-Json
if (-not $packageJson.build) {
    Write-ColorOutput Red "错误: package.json 中缺少 electron-builder 配置"
    exit 1
}

Write-Host "项目名称: " -NoNewline
Write-ColorOutput Green $packageJson.name
Write-Host "版本: " -NoNewline
Write-ColorOutput Green $packageJson.version

# 步骤3: 安装依赖
Show-Step "3/8" "安装项目依赖..."

try {
    npm install
}
catch {
    Write-ColorOutput Red "错误: 依赖安装失败"
    Write-ColorOutput Red $_.Exception.Message
    exit 1
}

# 步骤4: 清理旧的构建文件
Show-Step "4/8" "清理旧的构建文件..."

if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

if (Test-Path "release") {
    Remove-Item -Recurse -Force "release"
}

# 步骤5: 生成图标
Show-Step "5/8" "生成应用图标..."

if (Test-Path "scripts/generate-icons.js") {
    try {
        npm run generate-icons
    }
    catch {
        Write-ColorOutput Yellow "警告: 图标生成失败，但将继续构建"
    }
}
else {
    Write-ColorOutput Yellow "警告: 图标生成脚本不存在，跳过此步骤"
}

# 步骤6: 构建前端代码
Show-Step "6/8" "构建React前端代码..."

try {
    npm run build
}
catch {
    Write-ColorOutput Red "错误: 前端构建失败"
    Write-ColorOutput Red $_.Exception.Message
    exit 1
}

# 步骤7: 构建Electron应用
Show-Step "7/8" "构建Electron Windows应用..."

try {
    npx electron-builder --win --x64
}
catch {
    Write-ColorOutput Red "错误: Electron构建失败"
    Write-ColorOutput Red $_.Exception.Message
    exit 1
}

# 步骤8: 检查构建结果
Show-Step "8/8" "检查构建结果..."

if (Test-Path "release") {
    $winFiles = Get-ChildItem -Path "release" -Filter "*.exe" -Recurse
    $winFiles += Get-ChildItem -Path "release" -Filter "*portable*.*" -Recurse
    
    if ($winFiles.Count -gt 0) {
        Write-ColorOutput Green "构建成功! Windows应用程序已创建:"
        foreach ($file in $winFiles) {
            Write-ColorOutput Green "  - $($file.FullName)"
        }
        
        # 计算文件大小
        Write-Host "`n文件大小信息:"
        foreach ($file in $winFiles) {
            $size = [math]::Round($file.Length / 1MB, 2)
            Write-Host "  - $($file.Name): " -NoNewline
            Write-ColorOutput Cyan "$size MB"
        }
    }
    else {
        Write-ColorOutput Yellow "警告: 未找到Windows可执行文件，请检查release目录"
    }
}
else {
    Write-ColorOutput Red "错误: 构建失败，release目录不存在"
    exit 1
}

# 完成
Write-ColorOutput Green "`n======================================="
Write-ColorOutput Green "     构建完成!                         "
Write-ColorOutput Green "======================================="

# 打开输出目录
$openFolder = Read-Host "是否打开输出目录? (Y/N)"
if ($openFolder -eq "Y" -or $openFolder -eq "y") {
    explorer.exe (Resolve-Path ".\release").Path
}

Write-Host "按任意键退出..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")