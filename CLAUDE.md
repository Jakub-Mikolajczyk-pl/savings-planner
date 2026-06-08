# CLAUDE.md — savings-planner

See `AGENTS.md` for memory, project context, and checkpoint discipline.

---

## HUMAN-VERIFY block — mandatory in every handover

Every handover file in `docs/planning/EPIC-*.md` **MUST** end with a
`HUMAN-VERIFY` block.  A pre-commit hook (`.githooks/pre-commit`) will reject
the commit if the block is absent.

### What goes in it

Behavioral checks that only Jakub-as-tester can confirm by using the **deployed
app on `savings.lan`** — not code-level checks (those belong in the agent DoD).

- ✅ Behavioral: "category rules hit ≥80% on a real import"
- ❌ Not behavioral: "unit tests green", "`npm run build` passes"

### Exact marker format (do not change the comment text)

```markdown
<!-- HUMAN-VERIFY:START -->
## Human verification (on savings.lan)

- [ ] <first behavioral check on the live app>
- [ ] <second behavioral check>
- [ ] <third behavioral check>
<!-- HUMAN-VERIFY:END -->
```

### Worked example (EPIC 9 — categorization)

```markdown
<!-- HUMAN-VERIFY:START -->
## Human verification (on savings.lan)

- [ ] Category rules hit ≥80% on a real bank-statement import (CSV upload flow)
- [ ] LLM fallback fires only on uncategorized rows — already-ruled rows stay untouched
- [ ] Manual category override on a transaction persists after browser reload
<!-- HUMAN-VERIFY:END -->
```

Copy this block verbatim into your handover and replace the checklist items with
checks specific to that EPIC.  The template is at
`docs/planning/_TEMPLATE.md`.

---

## Git hooks bootstrap (run once per clone)

Git does **not** auto-activate hooks from a versioned directory — every clone
(including yours and Codex's) must run once:

```bash
bash scripts/bootstrap.sh
```

or manually:

```bash
git config core.hooksPath .githooks
```

Add this step to your setup after `npm install`.  Without it the pre-commit
gate is silently bypassed.
