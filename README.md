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
| **LocalStorage persistence** | All data survives page reload; no backend, no telemetry |
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

## How it works

All logic runs in the browser. The core engine (`src/domain/allocation.ts`) simulates a monthly schedule:

1. **Loan payments** are deducted first (minimum payment + any overpayment, avalanche order).
2. **Free cash** (income - expenses - loan payments) is distributed to goals:
   - Goals with a **fixed monthly allocation** get that amount first.
   - Remaining cash is split by **urgency** (deadline proximity x amount remaining).
3. **What-if bonus pool** (positive income delta) is added on top of fixed allocations, so the slider always has a visible effect.
4. **GoalProgress** records when each goal completes relative to its deadline: "on time", "missed", or "no deadline".

Data never leaves the device. The schedule is recalculated reactively on every state change via Zustand selectors and `useMemo`.

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
