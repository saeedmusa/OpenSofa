#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════════════════
# OpenSofa — Universal Installer & Launcher
#
#   curl -fsSL cdn.jsdelivr.net/gh/saeedmusa/OpenSofa@latest/scripts/opensofa.sh | bash
# ══════════════════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

OPENSOFA_VERSION="1.0.0"
INSTALL_DIR="${OPENSOFA_INSTALL_DIR:-$HOME/.opensofa}"
BIN_DIR="${OPENSOFA_BIN_DIR:-$HOME/.local/bin}"
PORT="${OPENSOFA_PORT:-3000}"
REPO_URL="https://github.com/saeedmusa/opensofa.git"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─────────────────────────────────────────────────────────────────────────────
# Output Helpers
# ─────────────────────────────────────────────────────────────────────────────

logo() {
  echo -e "${CYAN}"
  echo "  ____                    _____     ____"
  echo " / __ \\___  __________   / ___/__  / __ \\___  ___  ____ _"
  echo "/ /_/ / _ \\/ ___/ ___/   \\__ \\/ _ \\/ /_/ / _ \\/ _ \\/ __ \`/"
  echo "\\____/  __/ /  (__  )   ___/ /  __/ ____/  __/  __/ /_/ /"
  echo "     /\\___/_/  /____/   /____/\\___/_/    \\___/\\___/\\__,_/"
  echo "    /_/  Remote Control for AI Coding Agents"
  echo -e "${NC}"
}

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
step() { echo -e "${BOLD}$1${NC}"; }

# ─────────────────────────────────────────────────────────────────────────────
# OS Detection
# ─────────────────────────────────────────────────────────────────────────────

detect_os() {
  case "$(uname -s)" in
    Darwin*) echo "macos" ;;
    Linux*)  echo "linux" ;;
    *)       echo "unknown" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64)  echo "amd64" ;;
    arm64|aarch64) echo "arm64" ;;
    *)       echo "$(uname -m)" ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────
# Prerequisites
# ─────────────────────────────────────────────────────────────────────────────

check_cmd() {
  command -v "$1" >/dev/null 2>&1
}

ensure_node() {
  if check_cmd node; then
    local ver
    ver=$(node -v 2>/dev/null | tr -d 'v')
    local major
    major=${ver%%.*}
    if [[ "$major" -ge 18 ]]; then
      ok "Node.js v${ver}"
      return 0
    fi
  fi
  fail "Node.js 18+ required"
  echo "Install: brew install node (macOS) or sudo apt install nodejs (Linux)"
  return 1
}

ensure_git() {
  if check_cmd git; then
    ok "Git"
    return 0
  fi
  fail "Git required"
  return 1
}

ensure_tmux() {
  if check_cmd tmux; then
    ok "tmux"
    return 0
  fi
  fail "tmux required"
  echo "Install: brew install tmux (macOS) or sudo apt install tmux (Linux)"
  return 1
}

ensure_cloudflared() {
  if check_cmd cloudflared; then
    ok "cloudflared"
    return 0
  fi
  
  info "Installing cloudflared..."
  case $(detect_os) in
    macos)
      brew install cloudflared 2>/dev/null || {
        fail "Failed to install cloudflared"
        return 1
      }
      ;;
    linux)
      local arch=$(detect_arch)
      curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}" -o /tmp/cloudflared
      sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
      sudo chmod +x /usr/local/bin/cloudflared
      ;;
  esac
  
  if check_cmd cloudflared; then
    ok "cloudflared installed"
    return 0
  fi
  return 1
}

ensure_agentapi() {
  if check_cmd agentapi; then
    ok "AgentAPI"
    return 0
  fi
  
  info "Installing AgentAPI..."
  local os=$(detect_os)
  local arch=$(detect_arch)
  local url="https://github.com/coder/agentapi/releases/latest/download/agentapi-${os}-${arch}"
  
  sudo mkdir -p /usr/local/bin 2>/dev/null || true
  sudo curl -fsSL "$url" -o /usr/local/bin/agentapi
  sudo chmod +x /usr/local/bin/agentapi
  
  if check_cmd agentapi; then
    ok "AgentAPI installed"
    return 0
  fi
  return 1
}

check_agents() {
  local found=0
  for cmd in claude aider goose opencode; do
    if check_cmd "$cmd"; then
      ok "$cmd found"
      ((found++))
    fi
  done
  
  if [[ $found -eq 0 ]]; then
    warn "No coding agent found"
    dim "Install one: claude, aider, goose, or opencode"
  fi
  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Installation
# ─────────────────────────────────────────────────────────────────────────────

install_opensofa() {
  logo
  
  step "Installing OpenSofa..."
  echo ""
  
  # Create directories
  mkdir -p "$INSTALL_DIR"
  mkdir -p "$BIN_DIR"
  
  # Check prerequisites
  step "Checking prerequisites..."
  ensure_node || exit 1
  ensure_git || exit 1
  ensure_tmux || exit 1
  ensure_cloudflared || warn "cloudflared optional - tunnel may not work"
  ensure_agentapi || warn "AgentAPI optional"
  check_agents
  echo ""
  
  # Clone or update
  step "Downloading OpenSofa..."
  
  # Check if running from within the repo (local development)
  local script_dir
  script_dir="$(cd "$(dirname "$0")" 2>/dev/null && pwd)" || ""
  
  if [[ -f "$script_dir/package.json" ]] && grep -q '"opensofa"' "$script_dir/package.json" 2>/dev/null; then
    # Running from within the repo - use current directory
    info "Running from local development directory"
    INSTALL_DIR="$script_dir"
    ok "Using local source: $script_dir"
  elif [[ -d "$INSTALL_DIR/repo" ]]; then
    info "Updating existing installation..."
    cd "$INSTALL_DIR/repo" && git pull -q
    ok "Updated"
  else
    info "Cloning from GitHub..."
    git clone -q "$REPO_URL" "$INSTALL_DIR/repo"
    cd "$INSTALL_DIR/repo"
    ok "Cloned"
  fi
  echo ""
  
  # Install dependencies
  step "Installing dependencies..."
  cd "$INSTALL_DIR/repo" 2>/dev/null || cd "$INSTALL_DIR"
  
  if [[ -f "package.json" ]]; then
    npm install --no-fund --no-audit --loglevel=error 2>&1 | tail -1 || true
    ok "Backend dependencies"
    
    # Frontend
    if [[ -f "src/web/frontend/package.json" ]]; then
      cd src/web/frontend
      npm install --no-fund --no-audit --loglevel=error 2>&1 | tail -1 || true
      cd "$INSTALL_DIR/repo" 2>/dev/null || cd "$INSTALL_DIR"
      ok "Frontend dependencies"
    fi
  fi
  echo ""
  
  # Build
  step "Building..."
  if [[ -f "package.json" ]]; then
    npm run build 2>&1 | grep -vE "^$" | tail -5 || true
    ok "Backend built"
    
    if [[ -f "src/web/frontend/package.json" ]]; then
      cd src/web/frontend
      npm run build 2>&1 | grep -vE "^$" | tail -5 || true
      cd "$INSTALL_DIR/repo" 2>/dev/null || cd "$INSTALL_DIR"
      ok "Frontend built"
    fi
  fi
  echo ""
  
  # Create launcher
  create_launcher
  
  step "Installation Complete!"
  echo ""
  ok "Run: opensofa"
}

# ─────────────────────────────────────────────────────────────────────────────
# Launcher
# ─────────────────────────────────────────────────────────────────────────────

create_launcher() {
  local launcher="$BIN_DIR/opensofa"
  local repo_dir
  repo_dir="$(cd "$INSTALL_DIR/repo" 2>/dev/null && pwd || echo "$INSTALL_DIR")"
  
  cat > "$launcher" << EOF
#!/usr/bin/env bash
# OpenSofa Launcher v$OPENSOFA_VERSION
set -euo pipefail

REPO_DIR="$repo_dir"
LOG_FILE="\$HOME/.opensofa/opensofa.log"
PID_FILE="\$HOME/.opensofa/opensofa.pid"
PORT="$PORT"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
BOLD='\\033[1m'
NC='\\033[0m'

ok() { echo -e "\${GREEN}✓\${NC} \$1"; }
warn() { echo -e "\${YELLOW}⚠\${NC} \$1"; }
info() { echo -e "\${BLUE}→\${NC} \$1"; }
fail() { echo -e "\${RED}✗\${NC} \$1"; }

is_running() {
  [[ -f "\$PID_FILE" ]] && kill -0 "\$(cat "\$PID_FILE" 2>/dev/null)" 2>/dev/null
}

get_pid() {
  cat "\$PID_FILE" 2>/dev/null
}

start_server() {
  mkdir -p "\$(dirname "\$LOG_FILE")"
  cd "\$REPO_DIR"
  nohup node --max-old-space-size=512 dist/main.js >> "\$LOG_FILE" 2>&1 &
  echo \$! > "\$PID_FILE"
}

stop_server() {
  if [[ -f "\$PID_FILE" ]]; then
    kill "\$(cat "\$PID_FILE")" 2>/dev/null || true
    rm -f "\$PID_FILE"
  fi
}

wait_for_tunnel() {
  local timeout=30 count=0
  info "Waiting for tunnel..."
  while [[ \$count -lt \$timeout ]]; do
    if [[ -f "\$LOG_FILE" ]]; then
      if grep -q "trycloudflare.com" "\$LOG_FILE" 2>/dev/null; then
        return 0
      fi
    fi
    sleep 1
    ((count++))
    printf "."
  done
  echo ""
  return 1
}

get_tunnel_url() {
  [[ -f "\$LOG_FILE" ]] && grep -oE "https://[a-z0-9-]+\\.trycloudflare\\.com" "\$LOG_FILE" 2>/dev/null | tail -1
}

case "\${1:-run}" in
  run|"")
    if is_running; then
      ok "Already running (PID: \$(get_pid))"
      echo "  URL: http://localhost:\$PORT"
      exit 0
    fi
    
    info "Starting OpenSofa..."
    start_server
    sleep 2
    
    if is_running; then
      ok "Started on port \$PORT"
      echo ""
      echo -e "\${BOLD}Local:\${NC}  http://localhost:\$PORT"
      
      if wait_for_tunnel; then
        local url
        url=\$(get_tunnel_url)
        if [[ -n "\$url" ]]; then
          echo ""
          echo -e "\${CYAN}╔ Scan QR code with phone:\${NC}"
          echo ""
          if command -v qrencode >/dev/null 2>&1; then
            qrencode -t ANSIUTF8 "\$url" 2>/dev/null || echo "\$url"
          else
            echo "  \$url"
            echo ""
            dim "(brew install qrencode for QR code)"
          fi
        fi
      else
        warn "Tunnel not available"
      fi
    else
      fail "Failed to start"
      echo "Check: tail -f \$LOG_FILE"
      exit 1
    fi
    ;;
    
  start)
    if is_running; then warn "Already running"; exit 0; fi
    info "Starting in background..."
    start_server
    sleep 2
    is_running && ok "Started (PID: \$(get_pid))" || { fail "Failed"; exit 1; }
    ;;
    
  stop)
    is_running || { info "Not running"; exit 0; }
    info "Stopping..."
    stop_server
    ok "Stopped"
    ;;
    
  restart)
    \$0 stop
    sleep 1
    \$0 run
    ;;
    
  status)
    if is_running; then
      ok "Running (PID: \$(get_pid))"
      echo "  Port: \$PORT"
      echo "  URL: http://localhost:\$PORT"
    else
      info "Not running"
    fi
    ;;
    
  logs)
    [[ -f "\$LOG_FILE" ]] && tail -f "\$LOG_FILE" || echo "No logs yet"
    ;;
    
  update)
    info "Updating..."
    cd "\$REPO_DIR"
    git pull -q
    npm install --no-fund --no-audit --loglevel=error 2>&1 | tail -1 || true
    npm run build 2>&1 | tail -5 || true
    [[ -f "src/web/frontend/package.json" ]] && {
      cd src/web/frontend
      npm install --no-fund --no-audit --loglevel=error 2>&1 | tail -1 || true
      npm run build 2>&1 | tail -5 || true
    }
    ok "Updated! Restart with: opensofa restart"
    ;;
    
  uninstall)
    warn "This removes OpenSofa completely"
    read -p "Continue? [y/N] " r
    [[ "\$r" != "y" ]] && { echo "Cancelled"; exit 0; }
    \$0 stop 2>/dev/null || true
    rm -rf "\$REPO_DIR"
    rm -rf "\$HOME/.opensofa"
    rm -f "\$0"
    ok "Uninstalled"
    ;;
    
  version|-v)
    echo "OpenSofa v$OPENSOFA_VERSION"
    ;;
    
  help|--help|-h)
    echo ""
    echo -e "\${BOLD}OpenSofa - Remote Control for AI Coding Agents\${NC}"
    echo ""
    echo "Usage: opensofa [command]"
    echo ""
    echo "Commands:"
    echo "  run       Start and show QR code (default)"
    echo "  start     Start in background"
    echo "  stop      Stop server"
    echo "  restart   Restart server"
    echo "  status    Check status"
    echo "  logs      View logs"
    echo "  update    Update to latest"
    echo "  uninstall Remove OpenSofa"
    echo "  version   Show version"
    echo ""
    ;;
    
  *)
    fail "Unknown: \$1"
    echo "Run: opensofa help"
    exit 1
    ;;
esac
EOF

  chmod +x "$launcher"
  ok "Command installed: opensofa"
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

case "${1:-}" in
  install|"") install_opensofa ;;
  --help|-h)
    echo "OpenSofa Installer v$OPENSOFA_VERSION"
    echo ""
    echo "Usage: curl -fsSL cdn.jsdelivr.net/gh/saeedmusa/opensofa@latest/scripts/opensofa.sh | bash"
    ;;
  *)
    echo "Unknown: $1" >&2
    exit 1
    ;;
esac
