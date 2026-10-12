@echo off
chcp 65001 >nul
title Offert fran platsbesoket
cd /d "%~dp0"

echo.
echo  ==========================================
echo   Offert fran platsbesoket - startar...
echo  ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  FEL: Node.js saknas.
  echo  Installera Node.js fran https://nodejs.org ^(knappen LTS^),
  echo  starta om datorn och dubbelklicka sedan pa starta.bat igen.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo  [1/3] Installerar appen. Forsta gangen tar det nagra minuter...
  call npm install
  if errorlevel 1 goto fel
)

if not exist .env (
  copy .env.example .env >nul
)

if not exist prisma\dev.db (
  echo  [2/3] Skapar databasen med exempeldata...
  call npm run db:setup
  if errorlevel 1 goto fel
)

echo.
echo  [3/3] Startar appen. Webblasaren oppnas automatiskt om en liten stund.
echo  STANG INTE DET HAR FONSTRET medan du anvander appen.
echo.
start "" cmd /c "timeout /t 12 >nul & start http://localhost:3000"
call npm run dev
goto slut

:fel
echo.
echo  NAGOT GICK FEL. Ta en skarmdump av det har fonstret
echo  ^(Windows-tangenten + Shift + S^) och skicka den till Claude.
echo.

:slut
pause
