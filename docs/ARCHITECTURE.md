# ARCHITECTURE — 611 Petty Cash

> **Purpose:** A precise map of the codebase for fast orientation mid-task (human or AI). Where each folder/file lives, what it's responsible for, and how one request travels end-to-end.
> **Audience:** future-me / AI assistant reference — dense and complete, not a tutorial.
> **Companion docs:** product spec in [`context.md`](../../context.md) · requirements in [`docs/PRD.md`](PRD.md) · screen sketches in [`docs/MOCKUPS.md`](MOCKUPS.md) · build history in [`WEEK1_PLAN.md`](../../WEEK1_PLAN.md) / [`WEEK2_PLAN.md`](../../WEEK2_PLAN.md).
> **Last verified against source:** 2026-07-07 (post Week-2 backend refactor).

---

## 1. The one-paragraph model

A **TanStack Start** app (React 19 + Nitro + Vite). File-based routes render React pages that read data through two providers — `AuthProvider` and `StoreProvider`. Those providers never touch the database directly; they call **server functions** (`createServerFn`), which run on the server, resolve the Better-Auth session, and execute every query inside a **Row-Level-Security transaction** against **PostgreSQL** via **Drizzle ORM**. The database itself enforces per-branch isolation, so the browser can never fetch another branch's rows.

```
Browser (React)                         Server (Nitro)                      Postgres
─────────────                           ──────────────                      ────────
routes/*.tsx
  │ useAuth() / useStore()
  ▼
lib/auth/auth.tsx  ─┐
lib/store/store.tsx ┘ call ──►  lib/server/fns.ts  (createServerFn)
                                     │  getAuthCtx()  ──► lib/auth/ctx.ts ──► lib/auth/server.ts (Better Auth)
                                     ▼
                                lib/server/data.ts  (mappers + queries)
                                     │  withRls(ctx, tx => …)
                                     ▼
                                lib/server/rls.ts   set_config('app.is_hq' | 'app.branch_id')
                                     ▼
                                lib/db/client.ts  (Drizzle + postgres.js) ──►  tables + RLS policies
                                                                                (scripts/rls.sql)
```

---

## 2. Directory map

```
petty-cash/
├── src/
│   ├── routes/          File-based routes (URLs). Pages + layout + guards.
│   ├── components/       Presentational + composite UI, grouped by domain.
│   ├── lib/              All non-UI logic: auth, db, server fns, calc, format, store.
│   ├── data/             ⚠ W1 legacy seed JSON (now orphaned — see §7).
│   ├── router.tsx        TanStack Router factory + type registration.
│   ├── routeTree.gen.ts  GENERATED route tree (do not edit by hand).
│   └── styles.css        Tailwind v4 entry + @theme tokens.
├── scripts/             DB lifecycle: schema push target, seed, RLS, verify.
├── docs/                PRD, mockups, and this file.
└── <root configs>       package.json, drizzle.config.ts, vite.config.ts, biome.json, …
```

---

## 3. `src/routes/` — URLs, pages, guards

File-based routing: the file path *is* the URL. `_` prefixes a **pathless layout** route (wraps children, adds no URL segment). `$` marks a **dynamic param**.

| File | URL | Responsibility |
|---|---|---|
| `__root.tsx` | — | Root document. Mounts providers: `<AuthProvider><StoreProvider>…`. Provider order matters — store depends on who's logged in. |
| `index.tsx` | `/` | Redirects to `/dashboard` or `/login`. |
| `login.tsx` | `/login` | Login form + demo-account quick-fill. Calls `useAuth().login` (async). |
| `forgot-password.tsx` / `reset-password.tsx` | | UI-only screens (not wired to a backend). |
| `_app.tsx` | — | Pathless layout → renders `AppShell` (sidebar + topbar + guards) around all authenticated pages. |
| `_app/dashboard.tsx` | `/dashboard` | Role switch → `HqDashboard` or `BranchDashboard`. |
| `_app/expenses.tsx` | `/expenses` | Branch user "My Receipts" — fund summary + grouped receipts. |
| `_app/submit-receipt.tsx` | `/submit-receipt` | Upload → mock OCR → editable form → `addExpense`. Branch only. |
| `_app/reports.tsx` | `/reports` | Filters + CSV/PDF export. Data already RLS-scoped. |
| `_app/settings.tsx` | `/settings` | Branch/account info. |
| `_app/branches/index.tsx` | `/branches` | HQ: all-branches list. HQ only. |
| `_app/branches/$branchId.tsx` | `/branches/:id` | HQ: one branch's detail. HQ only. |
| `_app/funding-plans.tsx` | `/funding-plans` | HQ: plans + record fund release. HQ only. |
| `_app/categories.tsx` | `/categories` | HQ: category management. HQ only. |
| `_app/users.tsx` | `/users` | HQ: user/account management. HQ only. |

**Guards live in [`components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx), not in the routes.** `HQ_ONLY` / `BRANCH_ONLY` path lists + a `useEffect` redirect enforce role boundaries even against a hand-typed URL. The shell shows a full-screen loader until `auth.ready && store.hydrated`.

---

## 4. `src/components/` — UI, grouped by domain

| Folder | Contents | Notes |
|---|---|---|
| `ui/` | `primitives.tsx` (Button, Card, Field, Input, Select, SectionCard, StatusPill, ProgressBar, EmptyState, `cx`), `StatCard.tsx`, `DataTable.tsx`, `Overlay.tsx` | Design-system building blocks. Start here for any shared widget. |
| `layout/` | `AppShell.tsx` (shell + **guards** + mobile FAB), `Sidebar.tsx`, `TopBar.tsx`, `nav.ts` (role→nav-items map) | The frame around every authenticated page. |
| `dashboard/` | `HqDashboard.tsx`, `BranchDashboard.tsx`, `FundOverview.tsx` (released/spent/remaining block, reused on receipts page), `CategoryDonutCard.tsx`, `RecentExpenses.tsx` | |
| `receipts/` | `GroupedExpenseList.tsx` (Month→Day→txn accordion), `ExpenseTable.tsx`, `ExpenseDetailDrawer.tsx`, `ReceiptPreview.tsx` | `showUsd` prop toggles USD vs local totals (branch = local only). |
| `funding/` | `EditPlanModal.tsx`, `FundReleaseModal.tsx` | HQ funding actions. |
| `charts/` | `DonutChart.tsx`, `BarChart.tsx` | Presentational SVG charts. |

**Convention:** components are presentational and receive data via props; pages (in `routes/`) pull from `useStore()` / `useAuth()` and pass it down.

---

## 5. `src/lib/` — the logic layer

### Data + backend (Week 2)
| File | Responsibility |
|---|---|
| `db/schema.ts` | Drizzle schema — 9 tables (4 Better-Auth: `user`/`session`/`account`/`verification`; 5 domain: `branches`/`expense_categories`/`funding_plans`/`fund_releases`/`expenses`). `user` has extra `role` + `branchId`. |
| `db/client.ts` | `postgres.js` connection (`DATABASE_URL`, the **limited** `petty_app` role) + Drizzle instance. Server-only. |
| `auth/server.ts` | Better Auth config — email/password, hashed, `role`/`branchId` custom fields (`input:false`). Server-only. |
| `auth/ctx.ts` | `getAuthCtx()` / `requireAuthCtx()` — resolves the cookie session → `{ userId, role, branchId }`. |
| `auth/auth.tsx` | **Client** `AuthProvider` / `useAuth()`. Mirrors the cookie session into React state. `login` is async → `{ ok, error? }`. |
| `server/rls.ts` | `withRls(ctx, fn)` — opens a DB transaction and `set_config('app.is_hq' | 'app.branch_id')` so RLS policies bind. `AuthCtx` type. |
| `server/data.ts` | The data layer: row↔domain mappers (Date→ISO), `getBootstrapData(ctx)`, and every mutation (`submitExpense`, `createFundingPlan`, …). Sensitive fields (branchId, submittedBy) are derived from `ctx`, never the client. |
| `server/fns.ts` | The RPC API — `createServerFn` wrappers the client calls. Auth: `getSessionFn`/`signInFn`/`signOutFn`. Data: `bootstrapFn` + one fn per mutation. |
| `store/store.tsx` | **Client** `StoreProvider` / `useStore()`. Loads `bootstrapFn()` on login; each mutation calls a server fn then `refresh()`. Same shape as W1 — mutations now return promises. |

### Pure logic + utilities (role-agnostic, no I/O)
| File | Responsibility |
|---|---|
| `calc.ts` | All derived numbers — `branchFinancials`, `globalTotals`, `balanceStatus`, category/branch aggregation, category helpers, `branchById`. **Single source of truth for money math.** |
| `types.ts` | Domain types (`Expense`, `Branch`, `FundingPlan`, `Role`, `CurrencyCode`, `AppData`, …) shared client+server. |
| `format.ts` | `formatMoney` / `formatAmount` / `formatUsd` / `formatPercent` / date formatters. |
| `currency/exchangeRate.ts` | Fixed seed FX rates + `toUsd` / `usdToLocal` / `rateToUsd`. (Live rates = future work.) |
| `ocr/ocrService.ts` | **Mock** OCR stub — returns `{amount,currency,date,…,confidence}` after a delay. Real OCR is future work. |
| `export.ts` | CSV builder + `printReport` (PDF via print). |
| `id.ts` | ID generation. |

---

## 6. `scripts/` + root config

| File | Role |
|---|---|
| `scripts/seed.ts` | Seeds domain tables (`bun run db:seed`). |
| `scripts/seed-users.ts` | Creates the 5 Better-Auth accounts, hashed (`bun run db:seed:users`). |
| `scripts/rls.sql` | Enables RLS + fail-closed per-branch policies keyed on the `app.is_hq`/`app.branch_id` session vars. |
| `scripts/verify-data.ts` | Proves isolation through the app's own `getBootstrapData()`. |
| `drizzle.config.ts` | drizzle-kit target — uses `ADMIN_DATABASE_URL` (owner role) for `db:push` / `db:studio`. |
| `vite.config.ts` | TanStack Start + Vite plugins; `#/*` path alias → `src/*`. |
| `biome.json` | Lint/format — tabs, double quotes. |
| `.env` (gitignored) | `DATABASE_URL` (app), `ADMIN_DATABASE_URL` (owner), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. |

**Two DB roles are load-bearing:** migrations/seed run as owner `postgres` (bypasses RLS); the app runs as `petty_app` (RLS *enforced*). If the app used the owner role, isolation would silently do nothing. See [`WEEK2_PLAN.md`](../../WEEK2_PLAN.md) §4.1.

---

## 7. ⚠ Legacy / dead code (W1 → orphaned by W2)

The W2 refactor moved persistence to Postgres but left the W1 in-browser store in the tree, now **unreferenced**:

| File | Status |
|---|---|
| `src/lib/store/persistence.ts` | Orphaned — imports `data/seed` but nothing imports it. The live store is `store/store.tsx`. |
| `src/data/seed.ts` + `src/data/*.json` | Orphaned as a runtime source — only `persistence.ts` reads them. The DB is now seeded from `scripts/seed.ts`. (The JSON still documents the seed shape.) |

> These are safe to delete once the browser click-through confirms the Postgres path fully replaces them. Kept for now as a fallback/reference during the W2 verification window.

---

## 8. Request lifecycle — one mutation, end to end

**"A Singapore branch user submits a receipt":**

1. **`routes/_app/submit-receipt.tsx`** — user uploads an image → `ocr/ocrService.ts` (mock) pre-fills the form → user confirms → calls `useStore().addExpense(input)`. Currency snapshot computed via `currency/exchangeRate.ts` (`toUsd`).
2. **`store/store.tsx`** — `addExpense` calls `submitExpenseFn({ data: input })`. Note the input carries *no* branchId — that's derived server-side.
3. **`server/fns.ts`** — `submitExpenseFn` handler runs on the server: `requireAuthCtx()` → resolves the cookie session.
4. **`auth/ctx.ts` → `auth/server.ts`** — Better Auth validates the session cookie → `{ userId, role:'branch_user', branchId:'br-sg' }`.
5. **`server/data.ts`** — `submitExpense(ctx, input)` sets `branchId = ctx.branchId` (server-derived) and calls `withRls`.
6. **`server/rls.ts`** — opens a transaction, `set_config('app.branch_id','br-sg')`, runs the Drizzle `INSERT`.
7. **`db/client.ts` → Postgres** — RLS policy (`scripts/rls.sql`) permits the insert only because `branch_id` matches the session var. Row committed.
8. Back in **`store/store.tsx`** — `addExpense` awaits then `refresh()` → `bootstrapFn()` re-reads RLS-scoped data → React re-renders the fund summary + receipt list.

**Read path is the same minus the mutation:** on login, `StoreProvider` calls `bootstrapFn()` → `getBootstrapData(ctx)` → `withRls` → the branch user gets only `br-sg` rows; HQ gets all. Isolation is the database's job, not the UI's.

---

## 9. Conventions cheat-sheet

- **Path alias:** `#/*` → `src/*`.
- **Add a page:** new file under `routes/_app/`; add nav in `components/layout/nav.ts`; if role-restricted, add its path to `HQ_ONLY`/`BRANCH_ONLY` in `AppShell.tsx`.
- **Add a mutation:** function in `server/data.ts` (wrapped in `withRls`) → wrapper in `server/fns.ts` → method in `store/store.tsx`.
- **Money math:** always via `calc.ts`; never inline. Historical USD snapshots are never recalculated.
- **Never import** `db/`, `auth/server.ts`, `server/data.ts`, or `server/rls.ts` from client code — they're server-only and must stay out of the browser bundle (verified: they land only in `.output/server/`).
- **Generated files** (`routeTree.gen.ts`) are never hand-edited.
```
