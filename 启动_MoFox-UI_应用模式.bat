@echo off
echo 启动 MoFox-UI 应用模式...
echo.

REM 启动 Rust 后端服务（后台运行）
echo 正在启动后端服务...
start /B cargo run > nul 2>&1

REM 等待服务启动
echo 等待服务启动...
timeout /t 3 /nobreak > nul

REM 使用Chrome应用模式打开（无地址栏、菜单栏等）
echo 正在打开应用界面...
start "" "chrome" --app=http://localhost:3000 --disable-web-security --user-data-dir=%TEMP%\mofox-ui-chrome

REM 如果Chrome不可用，尝试Edge
if errorlevel 1 (
    echo Chrome 不可用，尝试使用 Edge...
    start "" "msedge" --app=http://localhost:3000 --disable-web-security --user-data-dir=%TEMP%\mofox-ui-edge
)

REM 如果Edge也不可用，使用默认浏览器
if errorlevel 1 (
    echo 使用默认浏览器打开...
    start http://localhost:3000
)

echo MoFox-UI 已启动完成！
pause
