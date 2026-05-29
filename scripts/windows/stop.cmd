@echo off
REM ============================================================================
REM AI Office Agents - Windows 중지 런처
REM ============================================================================

setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title AI Office Agents - 중지

echo.
echo ============================================================
echo   AI Office Agents 중지
echo ============================================================
echo.

set "STOPPED_ANY=0"

REM --- DeskRPG (3000, 13000) --------------------------------------------------
for %%P in (3000 13000) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
    echo [*] 포트 %%P 점유 PID %%a 종료
    taskkill /F /PID %%a >nul 2>&1
    set "STOPPED_ANY=1"
  )
)

REM --- OpenClaw (18789) -------------------------------------------------------
choice /m "OpenClaw 게이트웨이(18789)도 중지하시겠어요"
if errorlevel 2 goto :skip_openclaw
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":18789 " ^| findstr "LISTENING"') do (
  echo [*] OpenClaw 게이트웨이 PID %%a 종료
  taskkill /F /PID %%a >nul 2>&1
  set "STOPPED_ANY=1"
)
:skip_openclaw

if "%STOPPED_ANY%"=="0" (
  echo [i] 가동 중인 서비스가 없습니다.
) else (
  echo.
  echo [✓] 중지 완료.
)

timeout /t 3 >nul
endlocal
exit /b 0
