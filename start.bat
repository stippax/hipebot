@echo off
setlocal
cd /d "%~dp0"

if not exist ".env.local" (
  echo Arquivo .env.local nao encontrado.
  echo Copie .env.local.example para .env.local e preencha o DISCORD_TOKEN.
  exit /b 1
)

call npm run start
