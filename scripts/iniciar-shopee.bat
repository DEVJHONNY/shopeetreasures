@echo off
setlocal
title ShopeeTreasures - Iniciar ou abrir painel
if exist "%~dp0shopee-afiliados\server.js" (set "SHOPEE_DIR=%~dp0shopee-afiliados") else (set "SHOPEE_DIR=%~dp0..")
cd /d "%SHOPEE_DIR%" || exit /b 1
node scripts/start-local.cjs
if errorlevel 1 pause
