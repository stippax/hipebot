@echo off
setlocal
cd /d "%~dp0"
title Lineup Labs Bot Local Start

echo Iniciando Lineup Labs Bot...
echo.

if not exist ".env.local" (
  echo Arquivo .env.local nao encontrado.
  echo Copie .env.local.example para .env.local e preencha o DISCORD_TOKEN.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Dependencias nao encontradas.
  echo Rode npm install antes de iniciar o bot.
  echo.
  pause
  exit /b 1
)

call npm.cmd run start
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo O bot foi encerrado com erro. Codigo: %EXIT_CODE%
) else (
  echo O bot foi encerrado normalmente.
)

pause
exit /b %EXIT_CODE%
