# Savings Planner

A client-side savings and debt tracker built for clarity. Set goals with deadlines, model loan payoffs, and run what-if simulations — all in the browser, no account required.

![Demo](docs/demo.gif)

> **Record your own GIF:** open the app, walk through adding a goal and a loan, drag to reorder, tweak the what-if slider. [ScreenToGif](https://www.screentogif.com/) (Windows) or [Kap](https://getkap.co/) (macOS) work well. Save to `docs/demo.gif` and commit.

---

## Features

| Feature | Details |
|---|---|
| **Savings goals** | Name, target amount, current saved, priority, optional deadline |
| **Deadline tracking** | Visual "on time / missed" badge per goal, shortfall-per-month hint |
| **Loan / instalment tracking** | Remaining balance + monthly payment; shown separately from living expenses |
| **Drag-and-drop priority** | Reorder goals; allocation engine follows the new order instantly |
| **What-if sliders** | Simulate income change (-5k ... +10k PLN/month) and loan overpayment |
| **Cumulative savings chart** | Goals as filled areas, loans as descending lines, vertical payoff markers |
| **Monthly schedule table** | Editable per-goal allocations per month, per-month income/expense overrides |
| **LocalStorage / API persistence** | Local mode by default; optional Kotlin/Spring Boot backend behind a feature flag |
| **Export / Import** | One-click JSON backup and restore |

---

## Tech stack

| Layer | Library |
|---|---|
| Build | Vite 6 |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 (persisted to localStorage) |
| Chart | Recharts 3 |
| Drag & drop | @dnd-kit/core + sortable |
| Icons | lucide-react |
| Tests | Vitest |

---

## Quick start

```bash
git clone https://github.com/Jakub-Mikolajczyk-pl/savings-planner.git
cd savings-planner
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
npm test          # unit tests
npm run build     # production build -> dist/
```

---

## Backend mode

The app defaults to local-only storage. To use the Spring Boot backend from `backend/`, create `.env.local`:

```bash
VITE_BACKEND=api
VITE_API_BASE_URL=http://localhost:8080
VITE_API_TOKEN=dev-token
```

Use `VITE_BACKEND=local` or omit it to keep the original browser-only behavior. In API mode, the frontend sends `X-Api-Token` on every `/api/**` request and hydrates Zustand from the backend on startup.

---

## Homelab deploy

Production deploy is built for Forgejo Actions on the homelab runner:

- `.forgejo/workflows/ci.yml` runs frontend lint/test/build and backend test/build.
- `.forgejo/workflows/deploy.yml` runs on `main`, builds frontend/backend Docker images, pushes them to Forgejo registry, and deploys them to CT111 over SSH.
- `docker-compose.prod.yml` runs two services on CT111: `frontend` nginx on port 80 and private `backend` on the compose network.
- `nginx.conf.template` serves the SPA and proxies `/api/**` to `backend:8080`, injecting `X-Api-Token` from the container env. The token is not baked into the browser bundle.

Required Forgejo Actions secrets:

```bash
REGISTRY_USER=<forgejo-user>
REGISTRY_TOKEN=<forgejo-package-token>
CT111_SSH_KEY=<private-key-for-deploy-user>
```

Required CT111 env file: `/opt/savings-planner/.env` based on `.env.example`.

Manual setup checklist: `docs/planning/EPIC-5-manual-setup.md`.

Rollback to a previous image SHA on CT111:

```bash
cd /opt/savings-planner
IMAGE_TAG=<previous-sha> docker compose -f docker-compose.prod.yml pull
IMAGE_TAG=<previous-sha> docker compose -f docker-compose.prod.yml up -d
```

---

## How it works

The planning engine runs in the browser. The core engine (`src/domain/allocation.ts`) simulates a monthly schedule:

1. **Loan payments** are deducted first (minimum payment + any overpayment, avalanche order).
2. **Free cash** (income - expenses - loan payments) is distributed to goals:
   - Goals with a **fixed monthly allocation** get that amount first.
   - Remaining cash is split by **urgency** (deadline proximity x amount remaining).
3. **What-if bonus pool** (positive income delta) is added on top of fixed allocations, so the slider always has a visible effect.
4. **GoalProgress** records when each goal completes relative to its deadline: "on time", "missed", or "no deadline".

In local mode, data never leaves the device. In API mode, the backend is the source of truth and Zustand acts as the UI cache. The schedule is recalculated reactively on every state change via Zustand selectors and `useMemo`.

---

## Project structure

```
src/
  domain/          # pure functions: allocation engine, formatting, types
  store/           # Zustand store (goals, loans, overrides, what-if state)
  components/
    hero/          # summary cards + income/expense inputs
    goals/         # goal CRUD + drag-and-drop list
    loans/         # loan CRUD list
    chart/         # SavingsChart (Recharts) + WhatIfSlider
    schedule/      # monthly schedule table with inline edits
    ui/            # shared: CurrencyInput, Collapsible, AdvancedSettings
```

---

## License

MIT
