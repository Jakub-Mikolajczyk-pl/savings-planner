# Next Best Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic next-best-action recommendation panel for the Plan page.

**Architecture:** Add a pure domain module that ranks one recommendation from existing forecast, security, IKZE, and goal data. Add a small React component that renders the model using existing Plan UI patterns.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS 4, lucide-react.

---

### Task 1: Domain Model

**Files:**
- Create: `src/domain/nextBestAction.ts`
- Test: `src/domain/nextBestAction.test.ts`

- [ ] Write tests first for deficit, security, IKZE, manual goal, and surplus branches.
- [ ] Run `npm test -- --run src/domain/nextBestAction.test.ts` and confirm failures are caused by the missing module.
- [ ] Implement `buildNextBestAction` with deterministic ranking.
- [ ] Re-run the focused test file and confirm all tests pass.

### Task 2: Plan Panel UI

**Files:**
- Create: `src/components/plan/NextBestActionPanel.tsx`
- Modify: `src/App.tsx`

- [ ] Render a compact recommendation section using `buildNextCycleForecast`, `buildSecurityBuffers`, and `buildNextBestAction`.
- [ ] Place it near the top of the Plan page, after monthly cashflow and before security buffers.
- [ ] Keep styling consistent with existing `SectionCard` and simple bordered panels.

### Task 3: Verification

**Files:**
- Existing test/build/lint configuration.

- [ ] Run `npm test -- --run src/domain/nextBestAction.test.ts`.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Smoke the Plan page in browser if a dev server can be started cleanly.
