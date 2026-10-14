@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
TITLE AMA FISIO - Instalacao do sistema

echo =========================================
echo       AMA FISIO - INSTALACAO
 echo =========================================
echo.
echo Etapa 1 - Configurar acesso de Amanda
where node >nul 2>&1
if errorlevel 1 goto missing_node
call npm run configurar:mestre
if errorlevel 1 goto failed

echo.
echo Etapa 2 - Instalar ferramentas para publicar
call npm install
if errorlevel 1 goto failed

echo.
echo Etapa 3 - Autorizar o Firebase pelo navegador
call npx firebase login
if errorlevel 1 goto failed

echo.
echo Etapa 4 - Publicar site e regras protegidas
call npm run deploy
if errorlevel 1 goto failed

echo.
echo Pronto! Abra a URL exibida pelo Firebase.
echo No site, digite Amanda Marinho e a senha configurada.
pause
exit /b 0

:missing_node
echo.
echo O Node.js precisa ser instalado primeiro.
echo Baixe a versao LTS em https://nodejs.org
pause
exit /b 1

:failed
echo.
echo A instalacao foi interrompida sem concluir todas as etapas.
echo Veja a mensagem de erro acima e consulte README.md.
pause
exit /b 1
