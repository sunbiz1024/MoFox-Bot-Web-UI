@echo off
chcp 65001 >nul
title MoFox-UI 启动程序

echo.
echo =====================================
echo        MoFox-UI 管理界面启动
echo =====================================
echo.

echo [信息] 正在检查 Rust 环境...
cargo --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Rust 环境，请先安装 Rust
    echo [提示] 请访问 https://rustup.rs/ 下载安装
    pause
    exit /b 1
)

echo [信息] Rust 环境检查通过
echo [信息] 正在启动 MoFox-UI 服务器...
echo [信息] 服务器将在 http://localhost:3000 启动
echo [信息] 请等待编译完成...
echo.

cd /d "%~dp0"
cargo run --release

if %errorlevel% neq 0 (
    echo.
    echo [错误] 启动失败，请检查错误信息
    pause
    exit /b 1
)

pause
