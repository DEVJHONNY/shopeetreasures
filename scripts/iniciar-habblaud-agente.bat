@echo off
setlocal
if exist "%~dp0habblaud\package.json" (set "HABBLAUD_DIR=%~dp0habblaud") else (set "HABBLAUD_DIR=%~dp0..\..\habblaud")
cd /d "%HABBLAUD_DIR%" || exit /b 1
echo Integracao real do Codex com o Habblaud.
echo Se o servidor estiver desligado, execute iniciar-habblaud.bat primeiro.
node --import tsx scripts/codex-install.ts status --conta .codex
start "" "http://127.0.0.1:4747"
echo.
echo Para eventos completos, aprove os hooks do Habblaud em /hooks no Codex.
echo Este atalho nao cria personagens nem atividades simuladas.
pause
