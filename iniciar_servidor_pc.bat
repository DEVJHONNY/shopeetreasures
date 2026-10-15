@echo off
title Servidor Shopee Afiliados + Cloudflare Tunnel
echo =============================================================
echo   INICIANDO VPS NO SEU PC (SHOPEE AFILIADOS + PROMOBOT)
echo =============================================================
echo.
echo 1. Iniciando servidor Node.js na porta 4000...
start "Servidor Node.js - Shopee" cmd /k "node server.js"

timeout /t 3 >nul

echo 2. Iniciando Cloudflare Tunnel seguro para a Internet...
echo.
echo Copie a URL do trycloudflare.com gerada abaixo para atualizar o Netlify se necessario.
echo =============================================================
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:4000
