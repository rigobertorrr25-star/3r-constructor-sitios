@echo off
title Impresion Restaurant Control (3R) - no cierres esta ventana
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Falta instalar Node.js. Descargalo de https://nodejs.org (version LTS) y vuelve a abrir este archivo.
  pause
  exit /b
)
:inicio
node agente-3r.mjs
echo El programa se detuvo. Se vuelve a prender en 5 segundos...
timeout /t 5 >nul
goto inicio
