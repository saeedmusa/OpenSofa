---
title: Code Quality Standards
category: standards
type: core
version: 1.0
created: 2026-03-21
updated: 2026-03-21
tags: [typescript, standards, quality, naming, error-handling]
related: [architecture.md, testing.md]
codebase_references:
  - path: tsconfig.json
    lines: 1-23
    description: TypeScript configuration with strict mode enabled
  - path: src/permission-classifier.ts
    lines: 1-143
    description: Example of regex-based code being replaced
  - path: src/web/destructive-patterns.ts
    lines: 1-56
    description: Example of regex patterns being replaced with token matching
---

# Code Quality Standards

## TypeScript Strict Mode

**Always enabled** — see `tsconfig.json` line 9: `"strict": true`

### Required Compiler Options
- `noImplicitReturns: true` — all code paths must return
- `noFallthroughCasesInSwitch: true` — switch cases must break/return
- `noUncheckedIndexedAccess: true` — array/object access returns `T | undefined`
- `forceConsistentCasingInFileNames: true` — import paths must match actual casing

### Type Safety Rules
- **No `any`** — use `unknown` + type guards instead
- **No type assertions** — use type narrowing or `satisfies` operator
- **Explicit return types** on public functions
- **Optional chaining** for nullable access: `obj?.prop?.method()`

## Naming Conventions

### Files
- **kebab-case** for all files: `agent-state-machine.ts`, `acp-parser.ts`
- **PascalCase** for React components: `ConversationHistory.tsx`
- **Test files**: `*.test.ts` or `*.spec.ts` alongside source

### Variables & Functions
- **camelCase** for variables, functions, methods: `getMessages()`, `sessionId`
- **PascalCase** for classes, interfaces, types: `AgentStateMachine`, `ToolCall`
- **UPPER_SNAKE_CASE** for constants: `DESTRUCTIVE_TOKENS`, `DEFAULT_TIMEOUT_MS`

### Code Style
- **No regex** — use `String.includes()` token matching or state machines
- **Early returns** — guard clauses at function top
- **Pure functions** where possible — avoid side effects
- **Descriptive names** — `isDestructive(command)` not `check(cmd)`

## Error Handling Patterns

### API Errors
```typescript
// Use structured error types
class AgentAPIError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'AgentAPIError';
  }
}

// Throw on non-OK responses
if (!res.ok) throw new AgentAPIError(`HTTP ${res.status}`, res.status);
```

### Async Error Handling
- **Always** use `try/catch` for async operations
- **Never** swallow errors — log with context
- **Graceful degradation** — show user-friendly messages

### Validation
- **Zod schemas** for runtime validation (see `package.json` line 32)
- **Parse at boundaries** — validate input at API edges
- **Type-safe internals** — trust types after validation

## Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|----------|---------------|
| Regex for detection | `String.includes()` token matching |
| `any` type | `unknown` + type guards |
| Nested ternaries | Early returns or if/else |
| Magic strings | Named constants |
| God functions | Single-responsibility functions |
| Silent catch | Log with context |

## Code Review Checklist

- [ ] TypeScript strict mode passes (`npm run build`)
- [ ] No `any` types introduced
- [ ] No regex patterns (use token matching)
- [ ] Error handling covers all paths
- [ ] Functions have explicit return types
- [ ] Names are descriptive and consistent
- [ ] Codebase references updated if structure changed
