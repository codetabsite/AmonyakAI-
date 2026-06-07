#!/bin/bash
set -e

APP_NAME="AIAssistant"
APP_DIR="${APP_NAME}.AppDir"

mkdir -p "$APP_DIR/usr/bin"
mkdir -p "$APP_DIR/usr/share/model"

cp ollama "$APP_DIR/usr/bin/ollama"
cp model/llama3.1-8b.gguf "$APP_DIR/usr/share/model/"
cp Modelfile "$APP_DIR/usr/share/"

cat > "$APP_DIR/AppRun" << 'EOF'
#!/bin/bash
APPDIR="$(dirname "$(readlink -f "$0")")"
cd "$APPDIR/usr/share"
"$APPDIR/usr/bin/ollama" create assistant -f Modelfile 2>/dev/null || true
"$APPDIR/usr/bin/ollama" run assistant
EOF
chmod +x "$APP_DIR/AppRun"

cat > "$APP_DIR/ai-assistant.desktop" << 'EOF'
[Desktop Entry]
Name=AI Assistant
Exec=AppRun
Icon=ai-assistant
Type=Application
Categories=Utility;
EOF

cat > "$APP_DIR/ai-assistant.png" << 'EOF'
EOF

./appimagetool "$APP_DIR" "${APP_NAME}-x86_64.AppImage"
