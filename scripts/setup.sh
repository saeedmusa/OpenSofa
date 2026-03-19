#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# OpenSofa — Full Setup Script
# Installs all prerequisites, configures, and builds
# Web-only PWA architecture — no WhatsApp dependency
# ─────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }

OPENSOFA_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  OpenSofa — Setup"
echo "═══════════════════════════════════════════════════"
echo ""

# ─── 1. System Prerequisites ────────────────────────────
echo "▸ Checking system prerequisites..."

# Node.js
if command -v node &>/dev/null; then
  ok "Node.js $(node -v)"
else
  fail "Node.js not found. Install via: brew install node"
  exit 1
fi

# npm
if command -v npm &>/dev/null; then
  ok "npm $(npm -v)"
else
  fail "npm not found"
  exit 1
fi

# Git
if command -v git &>/dev/null; then
  ok "Git $(git --version | awk '{print $3}')"
else
  fail "Git not found. Install via: brew install git"
  exit 1
fi

# Go (optional, for development)
if command -v go &>/dev/null; then
  ok "Go $(go version | awk '{print $3}')"
fi

echo ""

# ─── 2. AgentAPI ────────────────────────────────────────
echo "▸ Checking AgentAPI..."

install_agentapi() {
  local OS ARCH INSTALL_DIR BIN_PATH
  OS=$(uname -s | tr "[:upper:]" "[:lower:]")
  ARCH=$(uname -m | sed "s/x86_64/amd64/;s/aarch64/arm64/")
  INSTALL_DIR="/usr/local/bin"
  BIN_PATH="$INSTALL_DIR/agentapi"
  
  warn "AgentAPI not found. Installing binary..."
  sudo mkdir -p "$INSTALL_DIR"
  sudo curl -fsSL "https://github.com/coder/agentapi/releases/latest/download/agentapi-${OS}-${ARCH}" -o "$BIN_PATH"
  sudo chmod +x "$BIN_PATH"
}

if command -v agentapi &>/dev/null; then
  ok "AgentAPI found: $(which agentapi)"
else
  install_agentapi
  if command -v agentapi &>/dev/null; then
    ok "AgentAPI installed: $(which agentapi)"
  else
    fail "AgentAPI install failed"
    exit 1
  fi
fi

echo ""

# ─── 3. Coding Agent ───────────────────────────────────
echo "▸ Checking coding agent..."

AGENT_FOUND=false
if command -v claude &>/dev/null; then
  ok "Claude Code $(claude --version 2>/dev/null || echo 'found')"
  AGENT_FOUND=true
fi
if command -v aider &>/dev/null; then
  ok "Aider found"
  AGENT_FOUND=true
fi
if command -v goose &>/dev/null; then
  ok "Goose found"
  AGENT_FOUND=true
fi

if [ "$AGENT_FOUND" = false ]; then
  warn "No coding agent found!"
  echo "  Install at least one:"
  echo "    npm install -g @anthropic-ai/claude-code"
  echo "    pip install aider-chat"
  echo "    brew install goose"
  echo ""
  echo "  Continuing setup — you can install an agent later."
fi

echo ""

# ─── 4. npm Dependencies ───────────────────────────────
echo "▸ Installing npm dependencies..."
cd "$OPENSOFA_DIR"

if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
  ok "node_modules exists, running npm ci for clean install..."
fi
npm install --no-fund --no-audit 2>&1 | tail -1
ok "npm dependencies installed"

echo ""

# ─── 5. Build Backend TypeScript ───────────────────────
echo "▸ Building backend TypeScript..."
npm run build 2>&1
ok "Backend build complete (dist/ directory)"

echo ""

# ─── 6. Build Frontend ────────────────────────────────
echo "▸ Building frontend..."
if [ -f "src/web/frontend/package.json" ]; then
  cd "$OPENSOFA_DIR/src/web/frontend"
  npm install --no-fund --no-audit 2>&1 | tail -1
  npm run build 2>&1
  ok "Frontend build complete"
  cd "$OPENSOFA_DIR"
else
  warn "Frontend package.json not found — skipping frontend build"
fi

echo ""

# ─── 7. Run Tests ──────────────────────────────────────
echo "▸ Running unit tests..."
npx vitest run 2>&1 | tail -5
echo ""

# ─── 8. Config Directory ──────────────────────────────
echo "▸ Checking config..."

CONFIG_DIR="$HOME/.opensofa"
mkdir -p "$CONFIG_DIR"

# Check for VAPID keys (auto-generated on first run)
if [ -f "$CONFIG_DIR/vapid-keys.json" ]; then
  ok "VAPID keys: configured (Web Push ready)"
else
  warn "VAPID keys: will be auto-generated on first run"
fi

# Generate config.yaml if not exists
CONFIG_FILE="$CONFIG_DIR/config.yaml"
if [ -f "$CONFIG_FILE" ]; then
  ok "Config file: $CONFIG_FILE"
else
  cat > "$CONFIG_FILE" << 'YAML'
# OpenSofa Configuration

# Default coding agent
defaultAgent: claude

# Maximum concurrent coding sessions
maxSessions: 5
portRangeStart: 3284

# Web server port
webPort: 3000

# Timings (ms)
debounceMs: 3000
approvalTimeoutMs: 300000
healthCheckIntervalMs: 10000
idleTimeoutMs: 600000

# Behavior
autoApprove: false
YAML
  ok "Config created at: $CONFIG_FILE"
fi

echo ""

# ─── 9. Test Git Repo ──────────────────────────────────
echo "▸ Checking test repo..."

TEST_REPO="$HOME/test-project"
if [ -d "$TEST_REPO/.git" ]; then
  ok "Test repo exists: $TEST_REPO"
else
  mkdir -p "$TEST_REPO"
  cd "$TEST_REPO"
  git init -q
  echo "# Test Project for OpenSofa" > README.md
  git add .
  git commit -q -m "initial commit"
  ok "Test repo created: $TEST_REPO"
fi

echo ""

# ─── 10. Summary ───────────────────────────────────────
echo "═══════════════════════════════════════════════════"
echo "  Setup Complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  To start OpenSofa:"
echo "    cd $OPENSOFA_DIR"
echo "    npm run dev          # development mode"
echo "    # OR"
echo "    npm start            # production mode"
echo ""
echo "  On first run:"
echo "    • Open http://localhost:3000 in a browser"
echo "    • Add to Home Screen on iOS for push notifications"
echo "    • VAPID keys will be auto-generated for Web Push"
echo ""
