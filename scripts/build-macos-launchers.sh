#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT_DIR"
OUTPUT_DIR="$ROOT_DIR/Launchers"
ICON_SOURCE="$ROOT_DIR/build/icon.icns"

if [[ ! -f "$ICON_SOURCE" ]]; then
  echo "Icon file missing: $ICON_SOURCE"
  echo "Run: npm run build:icons"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

create_launcher_app() {
  local app_name="$1"
  local mode="$2"
  local bundle_id="$3"
  local app_dir="$OUTPUT_DIR/${app_name}.app"
  local contents_dir="$app_dir/Contents"
  local macos_dir="$contents_dir/MacOS"
  local resources_dir="$contents_dir/Resources"
  local executable_name="launcher"

  rm -rf "$app_dir"
  mkdir -p "$macos_dir" "$resources_dir"

  cat > "$contents_dir/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>${app_name}</string>
  <key>CFBundleExecutable</key>
  <string>${executable_name}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>${bundle_id}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${app_name}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
</dict>
</plist>
EOF

  cat > "$macos_dir/$executable_name" <<EOF
#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$PROJECT_DIR"
MODE="$mode"

if [[ ! -d "\$PROJECT_DIR" ]]; then
  /usr/bin/osascript -e 'display dialog "Palimpseste project directory is missing: $PROJECT_DIR" buttons {"OK"} default button "OK"'
  exit 1
fi

if command -v osascript >/dev/null 2>&1; then
  /usr/bin/osascript <<OSA
set projectDir to POSIX path of "$PROJECT_DIR"
tell application "Terminal"
  activate
  do script "cd " & quoted form of projectDir & "; bash scripts/launch-app.sh $mode"
end tell
OSA
else
  cd "\$PROJECT_DIR"
  exec bash scripts/launch-app.sh "\$MODE"
fi
EOF

  chmod +x "$macos_dir/$executable_name"
  cp "$ICON_SOURCE" "$resources_dir/AppIcon.icns"
  printf 'APPL????' > "$contents_dir/PkgInfo"

  echo "Created: $app_dir"
}

create_launcher_app "Palimpseste Launcher" "menu" "com.palimpseste.launcher.menu"
create_launcher_app "Palimpseste Dev" "dev" "com.palimpseste.launcher.dev"
create_launcher_app "Palimpseste Restart" "restart-dev" "com.palimpseste.launcher.restart"
create_launcher_app "Palimpseste Electron" "electron-only" "com.palimpseste.launcher.electron"
create_launcher_app "Palimpseste Restart Electron" "restart-electron" "com.palimpseste.launcher.restart-electron"
create_launcher_app "Palimpseste Prod Local" "prod-local" "com.palimpseste.launcher.prodlocal"
create_launcher_app "Palimpseste Packaged" "packaged" "com.palimpseste.launcher.packaged"

echo
echo "Done. Open in Finder: $OUTPUT_DIR"
echo "Tip: drag 'Palimpseste Launcher.app' to the Dock."
