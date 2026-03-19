# Task Context: OpenSofa Comprehensive Fix

Session ID: 2026-03-14-comprehensive-fix
Created: 2026-03-14T00:00:00.000Z
Status: in_progress

## Current Request
Implement all fixes from docs/comprehensivefix.md, which includes:
- WhatsApp removal (W1-W15)
- Architecture spec alignment (A1-A7)
- Mobile coding capabilities (M1-M10)
- Code hygiene and testing (T1-T7)
- PWA hardening

## Context Files (Standards to Follow)
- TypeScript best practices
- React 18/19 patterns
- Node.js backend patterns

## Reference Files (Source Material to Look At)
- package.json - dependencies
- src/web/server.ts - main server
- src/web/broadcaster.ts - WebSocket handling
- src/web/activity-parser.ts - event parsing
- src/web/push.ts - push notifications
- src/session-manager.ts - session management
- src/db.ts - database initialization
- src/config.ts - configuration
- src/message-queue.ts - message queue
- src/web/frontend/src/components/VoiceInput.tsx - voice input component
- src/web/frontend/src/views/SessionView.tsx - main session view

## External Docs Fetched
- Socket.IO vs WebSocket comparison (2025 best practices)

## Components
1. WhatsApp Removal (15 files/changes)
2. Architecture Alignment (7 issues)
3. Mobile Capabilities (10 features)
4. PWA Hardening (8 items)
5. Code Hygiene (7 test cleanup items)

## Constraints
- Keep SQLite WAL mode (already done)
- Keep Hono server
- Keep web-push for notifications
- Need to add Socket.IO or improve WS handling
- Must support iOS 16.4+ for web push

## Exit Criteria
- [ ] All WhatsApp references removed
- [ ] Tests for deleted modules removed
- [ ] VoiceInput wired to SessionView
- [ ] File content preview working
- [ ] Git branch shown in SessionCard
- [ ] iOS PWA install banner added
- [ ] Event history persists to SQLite
- [ ] Message queue wired to session pipeline
- [ ] Build passes without errors
