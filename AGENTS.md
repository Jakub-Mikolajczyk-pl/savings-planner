# AGENTS.md — savings-planner

## Memory (READ FIRST)

Canonical memory for this workspace is in:

- `E:/repo/brain-memory`

Before starting work on `savings-planner`, read:

1. `E:/repo/brain-memory/INDEX.md`
2. `E:/repo/brain-memory/PROJECTS/savings-planner.md`
3. `E:/repo/brain-memory/CONVENTIONS.md`
4. Any relevant `E:/repo/brain-memory/STATE/*.md` if the task touches infra, homelab, deploy, devices, or second-brain state.

Do not look for `STATE/`, `PROJECTS/`, or `CONVENTIONS.md` inside this repo. They live in `E:/repo/brain-memory`.

## Checkpoint Discipline

After a deliverable accepted by Jakub:

1. Update `E:/repo/brain-memory/PROJECTS/savings-planner.md`:
   - append to `## Done log` (newest first),
   - update `current_focus`,
   - update `last_updated`.
2. If infra/system state changed, update the relevant `E:/repo/brain-memory/STATE/*.md`.
3. If an architectural decision was made, add `E:/repo/brain-memory/DECISIONS/YYYY-MM-DD-<slug>.md`.
4. Move/update the Todoist card in AI Workbench if the connector is available; otherwise tell Jakub exactly what to move.
5. Commit memory changes in `E:/repo/brain-memory`.

## HUMAN-VERIFY block — mandatory in every handover

Every file matching `docs/planning/EPIC-*.md` **MUST** contain the following
marker block, placed at the end of the file.  The pre-commit hook in
`.githooks/pre-commit` rejects commits that add/modify an EPIC handover without
the block.

**Exact markers (do not alter the comment text):**

```markdown
<!-- HUMAN-VERIFY:START -->
## Human verification (on savings.lan)

- [ ] <behavioral check on the live app>
<!-- HUMAN-VERIFY:END -->
```

Checklist items must be behavioral — verifiable by using `savings.lan` — not
code-level (no "tests green", "lint passes"). See `CLAUDE.md` for the full rule
and a worked example.

## Git hooks bootstrap (run once per clone)

```bash
bash scripts/bootstrap.sh   # sets core.hooksPath .githooks
```

Without this, the pre-commit gate is silently inactive.

## Project Notes

- Main app repo: `E:/repo/savings-planner`
- Current EPIC context lives in `E:/repo/brain-memory/PROJECTS/savings-planner.md`.
- EPIC handovers live in this repo under `docs/planning/`.
