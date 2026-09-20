---
name: verification-loop
description: Continuous verification gates for Voxtra sessions. Use after code changes and before PRs.
---

# Verification Loop

Adapted from Everything Claude Code `verification-loop` for Voxtra + OpenCode.

## When to Use

After features or significant changes, before PRs, after refactors.

## Phases (stop on failure)

### 1. Build
```bash
npm run build 2>&1 | tail -20
```

### 2. Typecheck
```bash
npx tsc --noEmit 2>&1 | head -30
```

### 3. Lint
```bash
npm run lint 2>&1 | head -30
```

### 4. Tests with coverage
```bash
npm test 2>&1 | tail -30
```
Target: 80%+ on touched modules. Report total/passed/failed/coverage.

### 5. Security scan
```bash
npm audit --audit-level=high
```
Plus: no secrets in diff, responses, logs, or `web/`. Never print secret values.

## Evidence Rule

Every claim of "works" needs command + output. Update `project-state/STATE.md` after verification.
