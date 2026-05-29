@echo off
REM ============================================================================
REM AI Office Agents - Windows 원클릭 설치
REM   - Node.js / Git / OpenClaw 확인
REM   - npm install
REM   - 바탕화면 바로가기 생성
REM ============================================================================

setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title AI Office Agents - 설치

echo.
echo ============================================================
echo   AI Office Agents 설치 마법사
echo ============================================================
echo.

REM --- 1) Node.js ------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
  echo [!] Node.js 가 필요합니다.
  echo     https://nodejs.org/ko 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
echo [+] Node.js %NODE_VER% 확인

REM --- 2) Git ----------------------------------------------------------------
where git >nul 2>&1
if errorlevel 1 (
  echo [!] Git 이 권장됩니다 ^(코드 업데이트용^).
  echo     https://git-scm.com/download/win
  echo     일단 계속 진행합니다.
)

REM --- 3) 프로젝트 루트 결정 -------------------------------------------------
set "PROJECT_ROOT=%~dp0..\.."
pushd "%PROJECT_ROOT%"
set "PROJECT_ROOT=%cd%"
popd
echo [+] 프로젝트 루트: %PROJECT_ROOT%

REM --- 4) npm install --------------------------------------------------------
if not exist "%PROJECT_ROOT%\desk_rpg_model\node_modules" (
  echo [*] desk_rpg_model 의존성 설치 중 ^(수 분 소요^) ...
  pushd "%PROJECT_ROOT%\desk_rpg_model"
  call npm install
  if errorlevel 1 (
    popd
    echo [!] npm install 실패. 위 로그를 확인하세요.
    pause
    exit /b 1
  )
  popd
)

REM --- 5) OpenClaw 확인 ------------------------------------------------------
where openclaw >nul 2>&1
if errorlevel 1 (
  echo.
  echo [i] OpenClaw 가 설치되어 있지 않습니다.
  echo     설치 ^(권장^): npm install -g openclaw
  echo     없이도 UI 는 켜지지만, NPC 가 응답하지 않습니다.
)

REM --- 6) 바탕화면 바로가기 -------------------------------------------------
echo.
choice /m "바탕화면에 '시작/중지' 바로가기를 만들까요"
if errorlevel 2 goto :skip_shortcut

set "DESKTOP=%USERPROFILE%\Desktop"
set "VBS_TMP=%TEMP%\ai-office-shortcut.vbs"

> "%VBS_TMP%" echo Set s = CreateObject^("WScript.Shell"^)
>> "%VBS_TMP%" echo Set lnk = s.CreateShortcut^("%DESKTOP%\AI Office 시작.lnk"^)
>> "%VBS_TMP%" echo lnk.TargetPath = "%~dp0AI-Office-Start.vbs"
>> "%VBS_TMP%" echo lnk.WorkingDirectory = "%~dp0"
>> "%VBS_TMP%" echo lnk.IconLocation = "%SystemRoot%\System32\shell32.dll, 220"
>> "%VBS_TMP%" echo lnk.Save
>> "%VBS_TMP%" echo Set lnk2 = s.CreateShortcut^("%DESKTOP%\AI Office 중지.lnk"^)
>> "%VBS_TMP%" echo lnk2.TargetPath = "%~dp0AI-Office-Stop.vbs"
>> "%VBS_TMP%" echo lnk2.WorkingDirectory = "%~dp0"
>> "%VBS_TMP%" echo lnk2.IconLocation = "%SystemRoot%\System32\shell32.dll, 131"
>> "%VBS_TMP%" echo lnk2.Save

cscript //nologo "%VBS_TMP%"
del "%VBS_TMP%" 2>nul
echo [+] 바탕화면 바로가기 생성 완료
:skip_shortcut

echo.
echo ============================================================
echo   ✓ 설치 완료!
echo ============================================================
echo   "AI Office 시작" 더블클릭으로 가동
echo   브라우저: http://localhost:3000/onboarding
echo ============================================================
pause
endlocal
exit /b 0
