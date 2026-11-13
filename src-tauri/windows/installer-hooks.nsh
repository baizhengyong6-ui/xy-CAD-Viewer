; Upgrade cleanup for the NSIS setup.exe.
;
; Tauri's installer already shows MUI_PAGE_DIRECTORY unless the run is passive,
; and /D= is applied before .onInit so a silent custom directory wins. On a
; normal run with no /D=, RestorePreviousInstallLocation keeps the last folder.
;
; What the stock script does not do is remove the previous install on a silent
; or /UPDATE run, and it only deletes a shortcut when the shortcut target is
; exactly this $INSTDIR. Per-user NSIS shortcuts and per-machine MSI shortcuts
; live in different Desktop and Start Menu folders, so an upgrade left the old
; ones behind. These hooks uninstall the previous NSIS and MSI registrations
; and delete the known shortcut names in both folders.

!macro XY_HookLog line
  Push $0
  ClearErrors
  FileOpen $0 "$TEMP\xinyao-nsis-hook.log" a
  ${IfNot} ${Errors}
    FileWrite $0 "${line}$\r$\n"
    FileClose $0
  ${EndIf}
  Pop $0
!macroend

!macro XY_DeleteKnownShortcuts
  Delete "$DESKTOP\XinyaoCADViewer.lnk"
  Delete "$DESKTOP\${PRODUCTNAME}.lnk"
  Delete "$DESKTOP\鑫垚CAD看图.lnk"
  Delete "$SMPROGRAMS\XinyaoCADViewer.lnk"
  Delete "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  Delete "$SMPROGRAMS\鑫垚CAD看图.lnk"
  Delete "$SMPROGRAMS\XinyaoCADViewer\XinyaoCADViewer.lnk"
  Delete "$SMPROGRAMS\XinyaoCADViewer\${PRODUCTNAME}.lnk"
  Delete "$SMPROGRAMS\XinyaoCADViewer\鑫垚CAD看图.lnk"
  Delete "$SMPROGRAMS\${PRODUCTNAME}\${PRODUCTNAME}.lnk"
  Delete "$SMPROGRAMS\鑫垚CAD看图\XinyaoCADViewer.lnk"
  Delete "$SMPROGRAMS\鑫垚CAD看图\${PRODUCTNAME}.lnk"
  Delete "$SMPROGRAMS\鑫垚CAD看图\鑫垚CAD看图.lnk"
  RMDir "$SMPROGRAMS\XinyaoCADViewer"
  RMDir "$SMPROGRAMS\${PRODUCTNAME}"
  RMDir "$SMPROGRAMS\鑫垚CAD看图"
!macroend

!macro XY_SilentNsisUninstall root
  Push $R8
  Push $R9
  ReadRegStr $R8 ${root} "${UNINSTKEY}" "UninstallString"
  ReadRegStr $R9 ${root} "${MANUPRODUCTKEY}" ""
  ${If} $R8 != ""
  ${AndIf} $R9 != ""
    !insertmacro XY_HookLog "uninstall nsis ${root} $R9"
    ExecWait '$R8 /S _?=$R9'
    Delete "$R9\uninstall.exe"
    RMDir "$R9"
  ${EndIf}
  Pop $R9
  Pop $R8
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro XY_HookLog "PREINSTALL instdir=$INSTDIR"
  !insertmacro XY_SilentNsisUninstall HKCU
  !insertmacro XY_SilentNsisUninstall HKLM

  Push $R3
  Push $R4
  Push $R5
  Push $R6
  Push $R7
  Push $R8
  Push $R9
  StrCpy $R5 0
  xy_msi_rescan:
    StrCpy $R6 0
    xy_msi_loop:
      EnumRegKey $R7 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" $R6
      StrCmp $R7 "" xy_msi_done
      IntOp $R6 $R6 + 1
      ReadRegStr $R8 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$R7" "DisplayName"
      StrCmp $R8 "XinyaoCADViewer" xy_msi_publisher
      StrCmp $R8 "${PRODUCTNAME}" xy_msi_publisher xy_msi_loop
      xy_msi_publisher:
      ReadRegStr $R8 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$R7" "Publisher"
      StrCmp $R8 "${MANUFACTURER}" 0 xy_msi_loop
      ReadRegStr $R8 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$R7" "UninstallString"
      ${StrCase} $R9 $R8 "L"
      ${StrLoc} $R4 $R9 "msiexec" ">"
      StrCmp $R4 "" xy_msi_loop
      ${StrLoc} $R4 $R9 "/x" ">"
      StrCmp $R4 "" xy_msi_loop
      !insertmacro XY_HookLog "uninstall msi $R8"
      ExecWait '$R8 /qn /norestart'
      IntOp $R5 $R5 + 1
      IntCmp $R5 8 xy_msi_done xy_msi_rescan xy_msi_done
  xy_msi_done:
  Pop $R9
  Pop $R8
  Pop $R7
  Pop $R6
  Pop $R5
  Pop $R4
  Pop $R3

  SetShellVarContext current
  !insertmacro XY_DeleteKnownShortcuts
  SetShellVarContext all
  !insertmacro XY_DeleteKnownShortcuts
  !insertmacro SetContext
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Stock shortcut creation returns early for /UPDATE. Recreate one set that
  ; points at this install after the stale links were removed.
  !if "${STARTMENUFOLDER}" != ""
    ${If} $AppStartMenuFolder == ""
      StrCpy $AppStartMenuFolder "${STARTMENUFOLDER}"
    ${EndIf}
    CreateDirectory "$SMPROGRAMS\$AppStartMenuFolder"
    CreateShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
  !else
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  !endif
  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
  !insertmacro XY_HookLog "POSTINSTALL $INSTDIR\${MAINBINARYNAME}.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  SetShellVarContext current
  !insertmacro XY_DeleteKnownShortcuts
  SetShellVarContext all
  !insertmacro XY_DeleteKnownShortcuts
  !insertmacro SetContext
!macroend
