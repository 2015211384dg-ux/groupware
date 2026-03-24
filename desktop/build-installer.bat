@echo off
chcp 65001 > nul
echo ===================================
echo  그룹웨어 알림 설치 파일 빌드
echo ===================================

set MAKENSIS=C:\Users\eus.service\AppData\Local\electron-builder\Cache\nsis\nsis-3.0.4.1\Bin\makensis.exe
set APP_DIR=C:\groupware\desktop\dist\groupware-win32-x64
set ASAR=C:\groupware\desktop\node_modules\@electron\asar\bin\asar.js

echo.
echo [1/3] electron-packager 로 앱 패키징 중...
cd /d C:\groupware\desktop
call npx electron-packager . "groupware" --platform=win32 --arch=x64 --out=dist --overwrite --ignore="(node_modules/electron-builder|node_modules/@electron/packager|node_modules/archiver|dist)"
if errorlevel 1 (
    echo 패키징 실패!
    pause
    exit /b 1
)

echo.
echo [2/3] main.js 최신 버전으로 업데이트 중...
mkdir "%APP_DIR%\resources\app_unpacked" 2>nul
node "%ASAR%" extract "%APP_DIR%\resources\app.asar" "%APP_DIR%\resources\app_unpacked"
copy /y "C:\groupware\desktop\main.js" "%APP_DIR%\resources\app_unpacked\main.js"
node "%ASAR%" pack "%APP_DIR%\resources\app_unpacked" "%APP_DIR%\resources\app.asar"
rmdir /s /q "%APP_DIR%\resources\app_unpacked"

echo.
echo [3/3] NSIS 설치 마법사 생성 중...
"%MAKENSIS%" /inputcharset UTF8 "C:\groupware\desktop\installer.nsi"
if errorlevel 1 (
    echo NSIS 빌드 실패!
    pause
    exit /b 1
)

echo.
echo ===================================
echo  완료! dist\그룹웨어알림-Setup.exe
echo ===================================
pause
