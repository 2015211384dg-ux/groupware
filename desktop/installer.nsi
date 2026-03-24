; 그룹웨어 알림 설치 마법사

Unicode true

!define APP_NAME "그룹웨어 알림"
!define APP_EXE "groupware.exe"
!define APP_SHORTCUT "그룹웨어 알림.lnk"
!define APP_DIR "C:\groupware\desktop\dist\groupware-win32-x64"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\AAS.PTK.GW"

Name "${APP_NAME}"
OutFile "C:\groupware\desktop\dist\그룹웨어알림-Setup.exe"
InstallDir "$PROGRAMFILES64\AAS.PTK.GW"
InstallDirRegKey HKCU "${UNINSTALL_KEY}" "InstallLocation"

RequestExecutionLevel admin

; 현대적인 UI
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ABORTWARNING
!define MUI_ICON "C:\groupware\desktop\build\icon.ico"
!define MUI_UNICON "C:\groupware\desktop\build\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\win.bmp"

; 설치 페이지
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "그룹웨어 알림을 지금 실행합니다"
!insertmacro MUI_PAGE_FINISH

; 제거 페이지
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; 언어 (한국어)
!insertmacro MUI_LANGUAGE "Korean"

; ──────────────────────────────────────
; 설치 섹션
; ──────────────────────────────────────
Section "그룹웨어 알림" SecMain

  SectionIn RO

  ; 기존 설치 디렉토리 정리
  RMDir /r "$INSTDIR"

  ; 루트 파일 (확장자 있는 것)
  SetOutPath "$INSTDIR"
  File "${APP_DIR}\*.pak"
  File "${APP_DIR}\*.dll"
  File "${APP_DIR}\*.exe"
  File "${APP_DIR}\*.dat"
  File "${APP_DIR}\*.bin"
  File "${APP_DIR}\*.json"

  ; 확장자 없는 파일 개별 지정
  File "${APP_DIR}\LICENSE"
  File "${APP_DIR}\version"

  ; 서브디렉토리
  SetOutPath "$INSTDIR\locales"
  File "${APP_DIR}\locales\*.pak"

  SetOutPath "$INSTDIR\resources"
  File "${APP_DIR}\resources\*"

  ; 바탕화면 바로가기 (모든 사용자 공용 바탕화면)
  SetOutPath "$INSTDIR"
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" "Common Desktop"
  CreateShortcut "$0\${APP_SHORTCUT}" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; 시작 메뉴 바로가기
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_SHORTCUT}" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\제거.lnk" "$INSTDIR\uninstall.exe"

  ; 제거 프로그램 등록
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0

  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName"      "${APP_NAME}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString"   "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation"   "$INSTDIR"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayIcon"       "$INSTDIR\${APP_EXE}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher"         "AAS.PTK"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion"    "1.0.0"
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "EstimatedSize"   "$0"
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify"        1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair"        1

SectionEnd

; ──────────────────────────────────────
; 제거 섹션
; ──────────────────────────────────────
Section "Uninstall"

  RMDir /r "$INSTDIR"
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" "Common Desktop"
  Delete "$0\${APP_SHORTCUT}"
  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Run\AAS.PTK.GW"

SectionEnd
