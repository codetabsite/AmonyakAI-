!define APP_NAME "AI Assistant"
!define APP_VERSION "1.0.0"
!define APP_DIR "$PROGRAMFILES\AIAssistant"

Name "${APP_NAME}"
OutFile "AIAssistant-Setup.exe"
InstallDir "${APP_DIR}"
RequestExecutionLevel admin

Section "Install"
    SetOutPath "$INSTDIR"
    File "ollama.exe"
    File "model\llama3.1-8b.gguf"
    File "Modelfile"

    ExecWait '"$INSTDIR\ollama.exe" create assistant -f "$INSTDIR\Modelfile"'

    CreateDirectory "$SMPROGRAMS\AI Assistant"
    CreateShortcut "$SMPROGRAMS\AI Assistant\AI Assistant.lnk" "$INSTDIR\ollama.exe" "run assistant"
    CreateShortcut "$DESKTOP\AI Assistant.lnk" "$INSTDIR\ollama.exe" "run assistant"

    WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
    Delete "$INSTDIR\ollama.exe"
    Delete "$INSTDIR\llama3.1-8b.gguf"
    Delete "$INSTDIR\Modelfile"
    Delete "$INSTDIR\uninstall.exe"
    RMDir "$INSTDIR"
    Delete "$SMPROGRAMS\AI Assistant\AI Assistant.lnk"
    Delete "$DESKTOP\AI Assistant.lnk"
SectionEnd
