// Generates docs/demo-data.json — a fully synthetic dataset for screenshots/demo.
// No real financial data. Import it in the app (Ustawienia → Import) to populate.
//
// Run: node scripts/make-demo-data.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// --- month helpers ---------------------------------------------------------
const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`
function monthRange(startY, startM, count) {
  const out = []
  let y = startY
  let m = startM
  for (let i = 0; i < count; i++) {
    out.push(ym(y, m))
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}
const MONTHS = monthRange(2025, 9, 10) // 2025-09 .. 2026-06
const round = (n) => Math.round(n)

// Linear ramp from `from` to `to` across MONTHS, with optional wobble.
function ramp(from, to, wobble = 0) {
  const n = MONTHS.length
  return MONTHS.map((_, i) => {
    const t = i / (n - 1)
    const base = from + (to - from) * t
    const w = wobble ? Math.sin(i * 1.7) * wobble : 0
    return round(base + w)
  })
}

// --- accounts (buckety) ----------------------------------------------------
const accountDefs = [
  { id: 'acc-personal',  name: 'Konto osobiste',        bucket: 'accounts',       from: 9800,   to: 12400, wobble: 900 },
  { id: 'acc-joint',     name: 'Konto wspólne',          bucket: 'accounts',       from: 14200,  to: 18900, wobble: 700 },
  { id: 'acc-cushion',   name: 'Konto oszczędnościowe',  bucket: 'safety_cushion', from: 78000,  to: 96000 },
  { id: 'acc-emergency', name: 'Fundusz awaryjny',       bucket: 'emergency_fund', from: 10000,  to: 10000 },
  { id: 'acc-ikze-a',    name: 'IKZE Anna',              bucket: 'retirement',     from: 24300,  to: 28500 },
  { id: 'acc-ikze-m',    name: 'IKZE Marek',             bucket: 'retirement',     from: 18100,  to: 24100 },
  { id: 'acc-reno',      name: 'Remont mieszkania',      bucket: 'renovation',     from: 22000,  to: 35000 },
  { id: 'acc-etf',       name: 'ETF / rachunek makl.',   bucket: 'investments',    from: 118000, to: 142000, wobble: 4200 },
  { id: 'acc-vacation',  name: 'Wakacje',                bucket: 'vacation',       from: 3200,   to: 8600 },
]

const accounts = accountDefs.map(({ id, name, bucket }) => ({
  id, name, bucket, currency: 'PLN', openedAt: MONTHS[0],
}))

const accountSnapshots = accountDefs.flatMap((def) => {
  const series = ramp(def.from, def.to, def.wobble)
  return MONTHS.map((yearMonth, i) => ({ accountId: def.id, yearMonth, balance: series[i] }))
})

// --- settings --------------------------------------------------------------
const settings = {
  monthlyIncome: 13200,
  monthlyExpenses: 6800,
  startMonth: '2026-06',
  horizonMonths: 36,
  emergencyFundBuckets: ['safety_cushion'],
  safetyCushionMonths: 6,
  emergencyFundTarget: 10000,
  includeIkzeContributionsInCashflow: false,
  ikzePlans: [
    { id: 'ikze-a-2026', year: 2026, ownerName: 'Anna',  role: 'employee',     annualLimit: 10407.6, contributedAmount: 4200, payoutsLeft: 6 },
    { id: 'ikze-m-2026', year: 2026, ownerName: 'Marek', role: 'entrepreneur', annualLimit: 15611.4, contributedAmount: 6000, payoutsLeft: 6 },
  ],
  creditCard: { name: 'Karta kredytowa', limit: 12000, availableLimit: 8600, repaymentDayOfMonth: 18 },
}

// --- goals -----------------------------------------------------------------
const goals = [
  { id: 'goal-gift',     name: 'Prezent ślubny (siostra)', targetAmount: 4000,   currentSaved: 1200,  deadline: '2026-09-01', priority: 1 },
  { id: 'goal-vacation', name: 'Wakacje Grecja 2026',      targetAmount: 14000,  currentSaved: 8600,  deadline: '2026-07-15', priority: 2 },
  { id: 'goal-reno',     name: 'Remont kuchni',            targetAmount: 50000,  currentSaved: 35000, deadline: '2027-03-01', priority: 3, fixedAllocation: 1500 },
  { id: 'goal-etf',      name: 'Dopłata do ETF',           targetAmount: 200000, currentSaved: 142000, priority: 4 },
]

// --- loans -----------------------------------------------------------------
const loans = [
  { id: 'loan-car', name: 'Kredyt samochodowy', remainingBalance: 22000, monthlyPayment: 950 },
]

// --- mortgage --------------------------------------------------------------
const mortgagePlan = {
  id: 'mortgage-1',
  name: 'Mieszkanie',
  principal: 298000,
  annualInterestRate: 7.1,
  originalTermMonths: 300,
  termMonths: 276,
  monthlyOverpayment: 500,
  overpaymentMode: 'shortenTerm',
  oneTimeOverpayments: [
    { id: 'otp-1', yearMonth: '2026-12', amount: 10000 },
  ],
  refinanceAnnualInterestRate: 6.2,
  refinanceCost: 1500,
}

// --- subscriptions ---------------------------------------------------------
const subscriptions = [
  { id: 'sub-netflix', name: 'Netflix',        monthlyAmount: 43,    active: true,  category: 'Rozrywka', billingPeriod: 'monthly' },
  { id: 'sub-spotify', name: 'Spotify Family',  monthlyAmount: 8.5,   active: true,  category: 'Rozrywka', billingPeriod: 'monthly', shared: true, shareCount: 4, billingAmount: 34 },
  { id: 'sub-gym',     name: 'Siłownia',        monthlyAmount: 129,   active: true,  category: 'Zdrowie',  billingPeriod: 'monthly' },
  { id: 'sub-icloud',  name: 'iCloud 200GB',    monthlyAmount: 13.99, active: true,  category: 'Chmura',   billingPeriod: 'monthly' },
  { id: 'sub-domain',  name: 'Domena + hosting', monthlyAmount: 16.5, active: true,  category: 'Inne',     billingPeriod: 'yearly', billingAmount: 198 },
  { id: 'sub-hbo',     name: 'HBO Max',         monthlyAmount: 29.99, active: false, category: 'Rozrywka', billingPeriod: 'monthly' },
]

// --- upcoming expenses -----------------------------------------------------
const upcomingExpenses = [
  { id: 'exp-oc',     name: 'OC samochodu',           amount: 1450, targetMonth: '2026-08', isPaid: false },
  { id: 'exp-przeg',  name: 'Przegląd techniczny',    amount: 200,  targetMonth: '2026-07', isPaid: false },
  { id: 'exp-podatek', name: 'Podatek od nieruchomości', amount: 380, targetMonth: '2026-09', isPaid: false },
]

// --- inflation basket (EPIC 14) --------------------------------------------
const basketItems = [
  { id: 'bitem-serek',  normalizedName: 'piątnica serek wiejski bez laktozy', displayName: 'PIĄTNICA Serek wiejski bez laktozy 200g', brand: 'PIĄTNICA', unit: 'g',  packageSize: 200, kind: 'food',     tracked: true,  aliases: [] },
  { id: 'bitem-mleko',  normalizedName: 'mleko łaciate uht 3 2',              displayName: 'Mleko Łaciate UHT 3,2% 1L',               brand: 'ŁACIATE',  unit: 'l',  packageSize: 1,   kind: 'food',     tracked: true,  aliases: [] },
  { id: 'bitem-maslo',  normalizedName: 'masło extra',                        displayName: 'Masło Extra 200g',                                            unit: 'g',  packageSize: 200, kind: 'food',     tracked: true,  aliases: [] },
  { id: 'bitem-kawa',   normalizedName: 'san marco kawa mielona',             displayName: 'SAN MARCO Kawa mielona 250g',             brand: 'SAN MARCO', unit: 'g', packageSize: 250, kind: 'food',     tracked: true,  aliases: [] },
  { id: 'bitem-felix',  normalizedName: 'felix karma z łososiem dla kota',    displayName: 'Felix Karma z łososiem dla kota 400g',    brand: 'FELIX',    unit: 'g',  packageSize: 400, kind: 'pet',      tracked: true,  aliases: [] },
]

// unitPrice per szt/opak.; normalizedUnitPrice = zł/kg or zł/l
// g→kg: unitPrice/(packageSize/1000)  |  l→l: unitPrice/packageSize
function nup(unitPrice, unit, packageSize) {
  if (unit === 'g')  return Math.round((unitPrice / (packageSize / 1000)) * 100) / 100
  if (unit === 'kg') return Math.round((unitPrice / packageSize) * 100) / 100
  if (unit === 'ml') return Math.round((unitPrice / (packageSize / 1000)) * 100) / 100
  if (unit === 'l')  return Math.round((unitPrice / packageSize) * 100) / 100
  return undefined
}

let _bobs = 0
function bobs(itemId, date, store, unitPrice, qty, orderRef) {
  const { unit, packageSize } = basketItems.find(i => i.id === itemId)
  return {
    id: `bobs-${String(++_bobs).padStart(3, '0')}`,
    itemId, date, store, unitPrice,
    normalizedUnitPrice: nup(unitPrice, unit, packageSize),
    quantity: qty, isWeightItem: false, orderRef, source: 'email',
  }
}

const priceObservations = [
  // Serek wiejski 200g — frisco — +49% 2021→2026
  bobs('bitem-serek', '2021-05-15', 'frisco', 3.49, 2, 'DEMO-F001'),
  bobs('bitem-serek', '2022-11-08', 'frisco', 3.89, 2, 'DEMO-F004'),
  bobs('bitem-serek', '2023-08-22', 'frisco', 4.19, 2, 'DEMO-F006'),
  bobs('bitem-serek', '2025-01-10', 'frisco', 4.89, 2, 'DEMO-F008'),
  bobs('bitem-serek', '2026-06-01', 'frisco', 5.19, 2, 'DEMO-F010'),
  // Mleko UHT 1l — frisco — +52% 2021→2026
  bobs('bitem-mleko', '2021-05-15', 'frisco', 2.89, 4, 'DEMO-F001'),
  bobs('bitem-mleko', '2022-11-08', 'frisco', 3.89, 4, 'DEMO-F004'),
  bobs('bitem-mleko', '2023-08-22', 'frisco', 4.19, 4, 'DEMO-F006'),
  bobs('bitem-mleko', '2025-01-10', 'frisco', 4.29, 4, 'DEMO-F008'),
  bobs('bitem-mleko', '2026-06-01', 'frisco', 4.39, 4, 'DEMO-F010'),
  // Masło Extra 200g — frisco — +109% 2022→2026
  bobs('bitem-maslo', '2022-02-14', 'frisco', 5.49, 2, 'DEMO-F002'),
  bobs('bitem-maslo', '2023-04-03', 'frisco', 8.29, 2, 'DEMO-F005'),
  bobs('bitem-maslo', '2025-01-10', 'frisco', 9.49, 2, 'DEMO-F008'),
  bobs('bitem-maslo', '2026-06-01', 'frisco', 11.49, 2, 'DEMO-F010'),
  // Kawa mielona 250g — frisco — +50% 2022→2026
  bobs('bitem-kawa', '2022-02-14', 'frisco', 14.99, 1, 'DEMO-F002'),
  bobs('bitem-kawa', '2023-04-03', 'frisco', 19.99, 1, 'DEMO-F005'),
  bobs('bitem-kawa', '2025-01-10', 'frisco', 20.49, 1, 'DEMO-F008'),
  bobs('bitem-kawa', '2026-06-01', 'frisco', 22.49, 1, 'DEMO-F010'),
  // Felix karma 400g — lisek — +50% 2022→2026
  bobs('bitem-felix', '2022-04-20', 'lisek', 3.99, 4, 'DEMO-L002'),
  bobs('bitem-felix', '2024-02-09', 'lisek', 4.99, 4, 'DEMO-L007'),
  bobs('bitem-felix', '2025-03-18', 'lisek', 5.49, 4, 'DEMO-L009'),
  bobs('bitem-felix', '2026-06-01', 'lisek', 5.99, 4, 'DEMO-L011'),
]

const basketConfig = {
  basePeriod: '2021-05',
  method: 'laspeyres',
  trackingThreshold: 3,
  excludeWeightItems: true,
  officialCpi: [
    { month: '2022-12', valuePct: 16.6 },
    { month: '2023-06', valuePct: 11.5 },
    { month: '2023-12', valuePct: 6.2 },
    { month: '2024-06', valuePct: 2.5 },
    { month: '2025-01', valuePct: 5.3 },
    { month: '2025-12', valuePct: 4.8 },
    { month: '2026-04', valuePct: 4.1 },
  ],
}

// --- categories (minimal, for the Transactions tab) ------------------------
const categories = [
  { id: 1, name: 'Wynagrodzenie',   kind: 'recurring', cashflowTreatment: 'income' },
  { id: 2, name: 'Czynsz',          kind: 'fixed',     cashflowTreatment: 'expense' },
  { id: 3, name: 'Spożywcze',       kind: 'variable',  cashflowTreatment: 'expense' },
  { id: 4, name: 'Paliwo',          kind: 'variable',  cashflowTreatment: 'expense' },
  { id: 5, name: 'Restauracje',     kind: 'variable',  cashflowTreatment: 'expense' },
  { id: 6, name: 'Subskrypcje',     kind: 'recurring', cashflowTreatment: 'expense' },
  { id: 7, name: 'Oszczędności',    kind: 'recurring', cashflowTreatment: 'savings' },
  { id: 8, name: 'Transfery',       kind: 'recurring', cashflowTreatment: 'internal_transfer' },
]

const categoryRules = [
  { id: 1, matchField: 'counterparty', matchType: 'contains', pattern: 'PRACODAWCA', categoryId: 1, priority: 100, source: 'seed' },
  { id: 2, matchField: 'description',  matchType: 'contains', pattern: 'BIEDRONKA',  categoryId: 3, priority: 90,  source: 'seed' },
  { id: 3, matchField: 'description',  matchType: 'contains', pattern: 'ORLEN',      categoryId: 4, priority: 90,  source: 'seed' },
]

const out = {
  settings,
  goals,
  loans,
  accounts,
  accountSnapshots,
  categories,
  categoryRules,
  transactions: [],
  incomeAnchors: [],
  incomeAnchorCandidates: [],
  payPeriods: [],
  payPeriodSettings: { minCycleDays: 14 },
  mortgagePlan,
  subscriptions,
  upcomingExpenses,
  overrides: {},
  basketItems,
  priceObservations,
  basketConfig,
}

mkdirSync(join(root, 'docs'), { recursive: true })
const target = join(root, 'docs', 'demo-data.json')
writeFileSync(target, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(`Wrote ${target}`)
console.log(`  accounts: ${accounts.length}, snapshots: ${accountSnapshots.length}, goals: ${goals.length}`)
console.log(`  basket: ${basketItems.length} items, ${priceObservations.length} observations`)
