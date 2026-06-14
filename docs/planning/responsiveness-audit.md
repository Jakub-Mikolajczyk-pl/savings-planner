# Responsiveness Audit & Action Plan

This document outlines a responsiveness review of the client-side personal budget application. It lists observed layout issues on smaller screens (mobile and tablet) and sets out specific tasks to ensure a modern, premium, and seamless mobile-friendly user experience.

---

## 1. Global Navigation & Layout

### Issues
- **Horizontal Scroll on Mobile Nav**: On screens smaller than `lg` (1024px), the top horizontal navigation (`AppNav` in compact mode) uses `overflow-x-auto` to display all tabs on a single line. While functional, it hides navigation options off-screen and lacks visual indicators (like gradient fades) showing that the list is scrollable.
- **Top Header Spacing**: The mobile header is cramped on screens under 360px wide, and could wrap tab buttons too early if text is long.

### Tasks
- [ ] Add a subtle horizontal gradient fade (left/right) on the `.overflow-x-auto` container in `AppNav` to visually signal scrollability on mobile.
- [ ] Implement smooth scroll behavior (`scroll-smooth`) and optimize button touch target sizes (`min-h-[44px]` according to iOS/Android recommendations) for high mobile usability.

---

## 2. Majątek (Accounts & Assets)

### Issues
- **`AccountsTable` Sticky Columns Overlay**: The table uses `sticky left-0` for the "Miesiąc" column and `sticky right-0` for the "Suma majątku" column. On mobile (e.g., 320px–480px width), the combined width of these two sticky columns takes up nearly the entire viewport, completely hiding the middle account balance columns.
- **Visual Hover Disconnect**: When a row in `AccountsTable` is hovered, the middle cells get a hover background (`hover:bg-gray-50`), but the sticky left and right columns retain their hardcoded background (`bg-white`), breaking visual continuity.
- **Charts aspect ratio**: The Net Worth chart (`NetWorthChart.tsx`) and the assets breakdown pie chart (`AssetsPie.tsx`) do not scale down aspect ratios on small viewports, resulting in squished containers or clipping.

### Tasks
- [ ] Refactor `AccountsTable.tsx` to conditionally disable `sticky left-0` and `sticky right-0` on screens smaller than `sm` (640px) or when the table width is too narrow, or use a card-based layout for snapshots on mobile.
- [ ] Fix row hover continuity in the table by applying the hover background state to sticky columns:
  ```css
  tr:hover td.sticky {
    background-color: var(--color-gray-50);
  }
  ```
- [ ] Optimize the Recharts `ResponsiveContainer` heights on mobile: use a lower height (e.g. `200px` to `250px`) for charts on screens `< sm` to prevent them from taking up the entire screen height.

---

## 3. Plan (Monthly Schedule & Goals)

### Issues
- **`ScheduleTable` Horizontal Scroll**: The monthly cash flow allocation matrix (`ScheduleTable.tsx`) is extremely wide when the user has multiple goals. In narrow screen widths, horizontal scrolling works, but the sticky Month column lacks a vertical line/shadow separator, making it hard to see where the sticky column ends and scrollable content begins.
- **Goal pacing metrics grid (`GoalInsightsSection.tsx`)**: The actual-vs-plan goal rows overlap metrics under narrow container widths. *(Fixed in the first pass, but requires monitoring to prevent regression).*

### Tasks
- [ ] Add a vertical border or a subtle drop shadow to sticky cells in `ScheduleTable` and `AccountsTable` to separate the sticky column from scrollable data:
  ```css
  .sticky-left-shadow {
    box-shadow: 4px 0 8px -4px rgba(0, 0, 0, 0.1);
  }
  ```
- [ ] Ensure `InlineNumberEdit` inputs (`w-20`) in `ScheduleTable` have appropriate touch target sizes and do not scale inappropriately on iOS zoom-on-focus.

---

## 4. Kredyty & Hipoteka (Loans & Mortgage)

### Issues
- **WIBOR Scenarios Grid**: In `MortgageSection.tsx`, the WIBOR interest rate scenarios are displayed in a grid:
  ```tsx
  className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
  ```
  On mobile devices (320px width), the 2-column layout for WIBOR cards is extremely tight. If numbers are large, they wrap or clip the currency suffix.
- **Overpayment Mode Buttons**: The "Efekt nadpłaty" button group (Skróć okres / Zmniejsz ratę) uses a 2-column grid that can look squished on narrow viewports.

### Tasks
- [ ] In `MortgageSection.tsx`, refactor the WIBOR scenario grid to use `grid-cols-1 xs:grid-cols-2 sm:grid-cols-4` or a flex-wrap container to prevent text clipping on narrow mobile viewports.
- [ ] Refactor the button group for overpayment modes to stack vertically on tiny viewports (e.g. `< 350px`) and sit horizontally on wider screens.

---

## 5. Koszyk Inflacyjny (Inflation Basket)

### Issues
- **CPI Statistics Grid**: In `BasketPage.tsx`, stat cards are arranged as:
  ```tsx
  className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
  ```
  This stacks into 1 column on mobile. But the search and filter controls grid:
  ```tsx
  className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
  ```
  can cause dropdowns or input fields to shrink too much on intermediate breakpoints.
- **Basket Items Table**: The items table can overflow on mobile screens without a clean horizontal scroll bar or vertical stacking alternative.

### Tasks
- [ ] Add `overflow-x-auto` to the basket items list table container to ensure the table scrolls gracefully on mobile without breaking the overall layout.
- [ ] Wrap the form elements (Search, Category Filter, Store Filter, Sorting, Add Button) in a responsive container that stacks logically on screens `< lg` instead of forcing columns.

---

<!-- HUMAN-VERIFY:START -->
## Human verification (on savings.lan)

- [ ] Check if tables (`AccountsTable`, `ScheduleTable`) scroll horizontally on mobile browsers (iPhone/Android/developer tools mobile simulation) without horizontal page overflow of the main screen.
- [ ] Verify that hover styles are applied correctly to sticky left columns on a desktop resized to small widths.
- [ ] Verify that no text overlaps or clips inside WIBOR scenario cards when simulating a 360px viewport width.
<!-- HUMAN-VERIFY:END -->
