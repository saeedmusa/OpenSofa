---
title: Testing Workflows
category: workflows
type: core
version: 1.0
created: 2026-03-21
updated: 2026-03-21
tags: [testing, vitest, e2e, playwright, workflow]
related: [code-quality.md, architecture.md]
codebase_references:
  - path: package.json
    lines: 13-16
    description: Test scripts configuration
  - path: tests/
    description: Test directory structure
---

# Testing Workflows

## Quick Commands

```bash
# Run all tests in watch mode
npm test

# Run all tests once (CI mode)
npm run test:run

# Run E2E tests with Playwright
npm run test:e2e

# Run specific test file
npm test -- src/agent-state-machine.test.ts

# Run tests matching pattern
npm test -- --grep "permission"
```

## Test Framework: Vitest

**Configuration:** Vitest v2.0+ with TypeScript support

### Test File Locations
- **Unit tests:** Alongside source files (`*.test.ts`)
- **Integration tests:** `tests/integration/`
- **E2E tests:** `tests/e2e/` (Playwright)

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { isDestructive } from './destructive-tokens';

describe('isDestructive', () => {
  it('detects rm -rf as dangerous', () => {
    const result = isDestructive('rm -rf /tmp/data');
    expect(result.dangerous).toBe(true);
    expect(result.label).toBe('File Deletion');
  });

  it('allows safe commands', () => {
    const result = isDestructive('ls -la');
    expect(result.dangerous).toBe(false);
  });
});
```

## Test Patterns

### Mocking AgentAPI
```typescript
// Mock fetch for AgentAPI calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ messages: [] }),
});
```

### Testing State Machines
```typescript
it('transitions to AWAITING_INPUT on question', async () => {
  const machine = new AgentStateMachine();
  machine.handleStatusChange('running');
  machine.handleStatusChange('stable');
  
  // Mock GET /messages returns question
  const state = await machine.analyzeLastMessage('Delete this file? [Y/n]');
  
  expect(state).toBe('AWAITING_INPUT');
});
```

### Testing Token Matching
```typescript
it('identifies destructive tokens', () => {
  expect(isDestructive('git push --force').dangerous).toBe(true);
  expect(isDestructive('git push').dangerous).toBe(false);
});
```

## E2E Testing (Playwright)

**Config:** `tests/e2e/playwright.config.cjs`

```bash
# Run E2E tests
npm run test:e2e

# Run with UI mode
npx playwright test --ui

# Run specific test
npx playwright test tests/e2e/sessions.spec.ts
```

### E2E Test Structure
```typescript
import { test, expect } from '@playwright/test';

test('create and interact with session', async ({ page }) => {
  await page.goto('/');
  await page.click('text=New Session');
  await page.fill('[name="directory"]', '~/projects/test');
  await page.click('text=Create');
  
  await expect(page.locator('.session-active')).toBeVisible();
});
```

## CI/CD Integration

### Pre-commit Checks
```bash
# Type checking
npm run build

# Linting (if configured)
npm run lint

# Tests
npm run test:run
```

### GitHub Actions Example
```yaml
- name: Test
  run: |
    npm ci
    npm run build
    npm run test:run
```

## Test Coverage

### What to Test
- ✅ **Pure functions** — token matching, parsers, mappers
- ✅ **State machines** — all transitions and edge cases
- ✅ **API routes** — request/response handling
- ✅ **Error paths** — network failures, invalid input

### What NOT to Test
- ❌ **Third-party libraries** — trust their tests
- ❌ **Simple getters/setters** — low value
- ❌ **Type definitions** — TypeScript handles this

## Debugging Tests

```bash
# Run with debug output
DEBUG=* npm test

# Run single test with console
npm test -- --reporter=verbose src/specific.test.ts

# Breakpoint in test
debugger; // Then run: node --inspect-brk node_modules/.bin/vitest run
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Tests fail in CI but pass locally | Check environment variables, timing |
| Mock not working | Ensure `vi.clearAllMocks()` in `beforeEach` |
| Timeout errors | Increase `testTimeout` in vitest config |
| Import errors | Check `tsconfig.json` paths and `moduleResolution` |
