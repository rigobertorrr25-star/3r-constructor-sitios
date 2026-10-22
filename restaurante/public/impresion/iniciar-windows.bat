@echo off
title Impresion Restaurant Control (3R) - no cierres esta ventana
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 goto hay_node
echo.
echo Falta instalar Node.js en este computador.
echo Descargalo de https://nodejs.org (boton LTS), instalalo y vuelve a abrir este archivo.
echo.
pause
exit /b
:hay_node
rem Para que el programa se prenda solo cada vez que se prende el computador (se hace una sola vez).
set "INICIO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Impresion 3R.bat"
if exist "%INICIO%" goto inicio
> "%INICIO%" echo @echo off
>> "%INICIO%" echo cd /d "%CD%"
>> "%INICIO%" echo start "Impresion 3R" /min "%~f0"
echo Listo: el programa se va a prender solo cada vez que prendas el computador.
:inicio
rem Si el navegador le cambio el nombre al programa (agente-3r (1).mjs, agente-3r.mjs.txt...), se usa ese.
if not exist "agente-3r.mjs" for %%F in ("agente-3r*") do copy /y "%%F" "agente-3r.mjs" >nul
rem Y si no esta en la carpeta, se descarga solo.
if not exist "agente-3r.mjs" echo Descargando el programa de impresion...
if not exist "agente-3r.mjs" curl -fsSL -o "agente-3r.mjs" "https://3r-constructor-sitios-git1.vercel.app/impresion/agente-3r.mjs"
if not exist "agente-3r.mjs" echo No se encontro agente-3r.mjs en esta carpeta. Descargalo de nuevo desde Impresoras y ponlo junto a este archivo.
node agente-3r.mjs
echo El programa se detuvo. Se vuelve a prender en 5 segundos...
timeout /t 5 >nul
goto inicio
