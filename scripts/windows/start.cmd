@echo off
REM ============================================================================
REM AI Office Agents - Windows 시작 런처 (.cmd)
REM
REM 사용법: 더블클릭. 콘솔 창이 깜빡이는 것이 싫다면 같은 폴더의
REM         "AI Office 시작.vbs" 를 대신 더블클릭하세요.
REM ============================================================================

setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title AI Office Agents - 시작 중

REM --- 프로젝트 루트 자동 탐색 -------------------------------------------------
set "PROJECT_ROOT="
if defined AI_OFFICE_HOME (
  if exist "%AI_OFFICE_HOME%\desk_rpg_model" set "PROJECT_ROOT=%AI_OFFICE_HOME%"
)
if not defined PROJECT_ROOT (
  if exist "%USERPROFILE%\ai-office-agents\desk_rpg_model" set "PROJECT_ROOT=%USERPROFILE%\ai-office-agents"
)
if not defined PROJECT_ROOT (
  if exist "%USERPROFILE%\Documents\ai-office-agents\desk_rpg_model" set "PROJECT_ROOT=%USERPROFILE%\Documents\ai-office-agents"
)
if not defined PROJECT_ROOT (
  if exist "%~dp0..\..\desk_rpg_model" set "PROJECT_ROOT=%~dp0..\.."
)
if not defined PROJECT_ROOT (
  echo.
  echo [!] AI Office Agents 폴더를 찾지 못했습니다.
  echo.
  echo 다음 위치 중 하나에 설치하세요:
  echo   - %%USERPROFILE%%\ai-office-agents
  echo   - %%USERPROFILE%%\Documents\ai-office-agents
  echo   - 또는 환경변수 AI_OFFICE_HOME 을 폴더 경로로 설정
  echo.
  pause
  exit /b 1
)

cd /d "%PROJECT_ROOT%"
if not exist "logs" mkdir logs
if not exist ".pids" mkdir .pids

REM --- 필수 도구 확인 ---------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo [!] Node.js 가 설치되어 있지 않습니다.
  echo     https://nodejs.org/ko 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [!] npm 을 찾을 수 없습니다. Node.js 설치를 확인하세요.
  pause
  exit /b 1
)

where openclaw >nul 2>&1
set "HAVE_OPENCLAW=1"
if errorlevel 1 set "HAVE_OPENCLAW=0"

REM --- 포트 점유 확인 (3000) --------------------------------------------------
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo [i] 이미 가동 중입니다 ^(http://localhost:3000^).
  echo.
  start "" "http://localhost:3000"
  timeout /t 3 >nul
  exit /b 0
)

echo.
echo ============================================================
echo   AI Office Agents 시작
echo   프로젝트 위치: %PROJECT_ROOT%
echo ============================================================
echo.

REM --- OpenClaw 게이트웨이 가동 -----------------------------------------------
if "%HAVE_OPENCLAW%"=="1" (
  netstat -ano | findstr ":18789 " | findstr "LISTENING" >nul 2>&1
  if errorlevel 1 (
    echo [*] OpenClaw 게이트웨이 시작 ^(포트 18789^) ...
    start "AI-Office OpenClaw" /MIN cmd /c "openclaw gateway --port 18789 > logs\openclaw.log 2>&1"
    timeout /t 3 >nul
  ) else (
    echo [*] OpenClaw 게이트웨이가 이미 가동 중
  )
) else (
  echo [!] OpenClaw 가 설치되어 있지 않습니다. LLM 응답 없이 UI 만 켜집니다.
  echo     설치: https://github.com/openclaw-ai/openclaw
)

REM --- 의존성 설치 (최초 1회) --------------------------------------------------
if not exist "desk_rpg_model\node_modules" (
  echo.
  echo [*] 처음 실행 - 의존성 설치 중 ^(수 분 소요^) ...
  pushd desk_rpg_model
  call npm install
  if errorlevel 1 (
    popd
    echo.
    echo [!] npm install 실패. 위 로그를 확인하세요.
    pause
    exit /b 1
  )
  popd
)

REM --- DeskRPG dev-server 가동 ------------------------------------------------
echo.
echo [*] DeskRPG dev-server 시작 ^(포트 3000^) ...
echo     로그: %PROJECT_ROOT%\logs\deskrpg.log

pushd desk_rpg_model
start "AI-Office DeskRPG" /MIN cmd /c "npm run dev > ..\logs\deskrpg.log 2>&1"
popd

REM --- 준비 대기 (최대 60초) --------------------------------------------------
set "READY=0"
for /l %%i in (1,1,30) do (
  netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
  if not errorlevel 1 (
    set "READY=1"
    goto :ready
  )
  timeout /t 2 >nul
)

:ready
echo.
if "%READY%"=="1" (
  echo ============================================================
  echo   ✓ 가동 완료!
  echo ============================================================
  echo   DeskRPG:    http://localhost:3000
  echo   첫걸음 가이드: http://localhost:3000/onboarding
  echo   정기 보고서:  http://localhost:3000/reports
  echo ============================================================
  echo.
  start "" "http://localhost:3000"
) else (
  echo [!] 60초 안에 준비되지 않았습니다.
  echo     logs\deskrpg.log 를 확인해주세요.
)

timeout /t 5 >nul
endlocal
exit /b 0
