#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-menu}"

print_help() {
  cat <<'EOF'
Palimpseste launcher

Usage:
  bash scripts/launch-app.sh menu
  bash scripts/launch-app.sh dev
  bash scripts/launch-app.sh restart-dev
  bash scripts/launch-app.sh electron-only
  bash scripts/launch-app.sh restart-electron
  bash scripts/launch-app.sh prod-local
  bash scripts/launch-app.sh packaged
EOF
}

ensure_dependencies() {
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    echo "node_modules missing. Installing dependencies..."
    (cd "$ROOT_DIR" && npm install)
  fi
}

collect_vite_pids() {
  pgrep -f "$ROOT_DIR/.*vite" || true
}

collect_electron_pids() {
  {
    pgrep -f "$ROOT_DIR/.*Electron\\.app/Contents/MacOS/Electron" || true
    pgrep -f "$ROOT_DIR/.*npx electron" || true
  } | awk 'NF { print $1 }' | sort -u
}

collect_waiton_pids() {
  pgrep -f "$ROOT_DIR/.*wait-on" || true
}

collect_project_pids() {
  {
    collect_vite_pids
    collect_electron_pids
    collect_waiton_pids
  } | awk 'NF { print $1 }' | sort -u
}

stop_pid_list() {
  local pid_list="$1"

  if [[ -z "$pid_list" ]]; then
    return
  fi

  # shellcheck disable=SC2086
  kill $pid_list >/dev/null 2>&1 || true
  sleep 1
  # shellcheck disable=SC2086
  kill -9 $pid_list >/dev/null 2>&1 || true
}

stop_project_processes() {
  local pid_list
  pid_list="$(collect_project_pids)"

  if [[ -z "$pid_list" ]]; then
    echo "No Palimpseste dev process found."
    return
  fi

  echo "Stopping existing processes: $pid_list"
  stop_pid_list "$pid_list"
}

stop_electron_processes() {
  local pid_list
  pid_list="$(collect_electron_pids)"

  if [[ -z "$pid_list" ]]; then
    echo "No Electron process found."
    return
  fi

  echo "Stopping Electron processes: $pid_list"
  stop_pid_list "$pid_list"
}

is_vite_running() {
  [[ -n "$(collect_vite_pids)" ]]
}

run_electron_only() {
  cd "$ROOT_DIR"

  if ! is_vite_running; then
    echo "Vite dev server is not running. Starting full dev stack instead."
    npm run dev:electron
    return
  fi

  VITE_DEV_SERVER_URL="${VITE_DEV_SERVER_URL:-http://127.0.0.1:5173}" npx electron .
}

open_packaged_app() {
  local app_path
  local dmg_path

  app_path="$(find "$ROOT_DIR/release" -maxdepth 4 -type d -name 'Palimpseste.app' | head -n 1 || true)"
  if [[ -n "$app_path" ]]; then
    echo "Opening packaged app: $app_path"
    open "$app_path"
    return
  fi

  dmg_path="$(find "$ROOT_DIR/release" -maxdepth 2 -type f -name 'Palimpseste-*.dmg' | sort | tail -n 1 || true)"
  if [[ -n "$dmg_path" ]]; then
    echo "Opening DMG: $dmg_path"
    open "$dmg_path"
    return
  fi

  echo "No packaged output found in release/. Run: npm run build:electron"
  exit 1
}

run_mode() {
  local selected_mode="$1"

  case "$selected_mode" in
    dev)
      ensure_dependencies
      if is_vite_running; then
        echo "Vite dev server already running. Launching Electron only."
        run_electron_only
      else
        cd "$ROOT_DIR"
        npm run dev:electron
      fi
      ;;
    restart-dev)
      ensure_dependencies
      stop_project_processes
      cd "$ROOT_DIR"
      npm run dev:electron
      ;;
    electron-only)
      ensure_dependencies
      run_electron_only
      ;;
    restart-electron)
      ensure_dependencies
      stop_electron_processes
      run_electron_only
      ;;
    prod-local)
      ensure_dependencies
      cd "$ROOT_DIR"
      npm run build
      npx electron .
      ;;
    packaged)
      open_packaged_app
      ;;
    *)
      print_help
      exit 1
      ;;
  esac
}

show_menu() {
  cat <<'EOF'
Palimpseste launcher
1. Dev (vite + electron)
2. Restart dev (kill old process + relaunch)
3. Electron only (vite already running)
4. Restart electron only
5. Prod local (build + electron)
6. Open packaged app (release/)
7. Quit
EOF

  read -r -p "Choose [1-7]: " choice

  case "$choice" in
    1) run_mode dev ;;
    2) run_mode restart-dev ;;
    3) run_mode electron-only ;;
    4) run_mode restart-electron ;;
    5) run_mode prod-local ;;
    6) run_mode packaged ;;
    7) exit 0 ;;
    *) echo "Invalid choice."; exit 1 ;;
  esac
}

case "$MODE" in
  menu)
    show_menu
    ;;
  dev|restart-dev|electron-only|restart-electron|prod-local|packaged)
    run_mode "$MODE"
    ;;
  help|-h|--help)
    print_help
    ;;
  *)
    print_help
    exit 1
    ;;
esac
