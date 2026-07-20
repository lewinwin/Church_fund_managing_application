# ARCHITECTURE — 611 Ministry Funding

> **Purpose:** A precise map of the codebase for fast orientation mid-task (human or AI). Where each folder/file lives, what it's responsible for, and how one request travels end-to-end.
> **Audience:** future-me / AI assistant reference — dense and complete, not a tutorial.
> **Companion docs:** product spec in [`context.md`](../../context.md) · requirements in [`docs/PRD.md`](PRD.md) · screen sketches in [`docs/MOCKUPS.md`](MOCKUPS.md) · build history in [`WEEK1_PLAN.md`](../../WEEK1_PLAN.md) / [`WEEK2_PLAN.md`](../../WEEK2_PLAN.md) / [`WEEK3_PLAN.md`](../../WEEK3_PLAN.md).
> **Last verified against source:** 2026-07-14 (Week 3: real OCR, receipt Storage, RLS → app-level branch gate).
> **Two builds:** `backend-supabase-included` (Supabase Postgres + Storage bucket for images) and `Win-branch` (pure PostgreSQL, base64 images in the DB). This doc describes the shared architecture; the few build-specific parts are flagged.

---

## 1. The one-paragraph model

A **TanStack Start** app (React 19 + Nitro + Vite). File-based routes render React pages that read data through two providers — `AuthProvider` and `StoreProvider`. Those providers never touch the database directly; they call **server functions** (`createServerFn`), which run on the server, resolve the Better-Auth session, and query **PostgreSQL** via **Drizzle ORM**. Branch isolation is applied in **application code** by a pure, testable helper — `branchScope(ctx, col)` adds `WHERE branch_id = …` for branch users (nothing for HQ) — so the browser can never fetch another branch's rows. *(This replaced per-request Postgres RLS in Week 3, for testability + no `set_config` round-trip.)*

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
                                     │  .where(branchScope(ctx, table.branchId))
                                     ▼
                                lib/server/scope.ts   branchScope() — HQ: no filter; branch: branch_id = theirs (pure, unit-tested)
                                     ▼
                                lib/db/client.ts  (Drizzle + postgres.js) ──►  tables (no RLS)
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
├── scripts/             DB lifecycle: schema push target, seed, drop-rls, verify.
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
| `_app/submit-receipt.tsx` | `/submit-receipt` | Upload → **Gemini OCR** (`ocrExtractFn`) pre-fills → editable form → `addExpense`. Branch only. |
| `_app/reports.tsx` | `/reports` | Filters + CSV/PDF export. Data already branch-scoped server-side. |
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
| `server/scope.ts` | **Branch-isolation gate** (replaced `rls.ts` in W3): `branchScope(ctx, col)` → Drizzle `WHERE` (undefined for HQ), `canWriteBranch(ctx, branchId)`. Pure functions + the `AuthCtx` type. Unit-tested in `scope.test.ts` — no DB needed. |
| `server/data.ts` | The data layer: row↔domain mappers (Date→ISO), `getBootstrapData(ctx)` (reads gated by `branchScope`), and every mutation. Sensitive fields (branchId, submittedBy) are derived from `ctx`, never the client. |
| `server/ocr.ts` | **Real OCR** via Gemini (`gemini-flash-latest`; `GEMINI_MODEL` overrides). `runReceiptOcr(dataUrl)` → `{amount,currency,date,description,confidence}`. Server-only (API key). Never throws → OCR failure falls back to manual entry. |
| `server/storage.ts` | *(Supabase build only)* receipt images → private Supabase **Storage** bucket. `uploadReceipt` (data URL → object path), `signedReceiptUrl` (short-lived view URL). Server-only (service_role key). `Win-branch` omits this and keeps base64 in the DB. |
| `server/fns.ts` | The RPC API — `createServerFn` wrappers the client calls. Auth: `getSessionFn`/`signInFn`/`signOutFn`. Data: `bootstrapFn` + one fn per mutation; `ocrExtractFn`; `receiptUrlFn` *(Supabase build)*. |
| `store/store.tsx` | **Client** `StoreProvider` / `useStore()`. Loads `bootstrapFn()` on login; each mutation calls a server fn then `refresh()`. Same shape as W1 — mutations now return promises. |

### Pure logic + utilities (role-agnostic, no I/O)
| File | Responsibility |
|---|---|
| `calc.ts` | All derived numbers — `branchFinancials`, `globalTotals`, `balanceStatus`, category/branch aggregation, category helpers, `branchById`. **Single source of truth for money math.** |
| `types.ts` | Domain types (`Expense`, `Branch`, `FundingPlan`, `Role`, `CurrencyCode`, `AppData`, …) shared client+server. |
| `format.ts` | `formatMoney` / `formatAmount` / `formatUsd` / `formatPercent` / date formatters. |
| `currency/exchangeRate.ts` | Fixed seed FX rates + `toUsd` / `usdToLocal` / `rateToUsd`. (Live rates = future work.) |
| `ocr/ocrService.ts` | ⚠ Legacy W1 **mock** OCR stub — superseded by `server/ocr.ts` (real Gemini) and no longer imported. |
| `export.ts` | CSV builder + `printReport` (PDF via print). |
| `id.ts` | ID generation. |

---

## 6. `scripts/` + root config

| File | Role |
|---|---|
| `scripts/seed.ts` | Seeds domain tables (`bun run db:seed`). |
| `scripts/seed-users.ts` | Creates the 5 Better-Auth accounts, hashed (`bun run db:seed:users`). |
| `scripts/drop-rls.sql` | Disables RLS + drops the per-branch policies on the scoped tables (run once per DB). Supersedes the old `rls.sql` — isolation now lives in app code (`scope.ts`). |
| `scripts/verify-data.ts` | Proves isolation through the app's own `getBootstrapData()`. |
| `drizzle.config.ts` | drizzle-kit target — uses `ADMIN_DATABASE_URL` (owner role) for `db:push` / `db:studio`. |
| `vite.config.ts` | TanStack Start + Vite plugins; `#/*` path alias → `src/*`. |
| `biome.json` | Lint/format — tabs, double quotes. |
| `.env` (gitignored) | `DATABASE_URL` (app), `ADMIN_DATABASE_URL` (owner), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GEMINI_API_KEY` (+ optional `GEMINI_MODEL`); Supabase build also `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. |

**Two DB roles:** migrations/seed run as owner `postgres`; the app runs as the limited `petty_app` (row DML grants, no DDL). Since W3 dropped RLS, the role no longer decides *which rows* are visible — that's `branchScope` in app code now — but a limited app role is still good least-privilege. See [`WEEK2_PLAN.md`](../../WEEK2_PLAN.md) §4.1.

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
5. **`server/data.ts`** — `submitExpense(ctx, input)` sets `branchId = ctx.branchId` (server-derived, never from the client). *(Supabase build: uploads the image to the Storage bucket first, stores only the path.)*
6. **`db/client.ts` → Postgres** — a plain Drizzle `INSERT` as `petty_app`. Row committed.
7. Back in **`store/store.tsx`** — `addExpense` awaits then `refresh()` → `bootstrapFn()` re-reads branch-scoped data → React re-renders the fund summary + receipt list.

**Read path:** on login, `StoreProvider` calls `bootstrapFn()` → `getBootstrapData(ctx)` → each branch-scoped read runs `.where(branchScope(ctx, table.branchId))` → a branch user gets only `br-sg` rows; HQ gets all. Isolation is enforced by the `branchScope` helper (unit-tested), not the database.

---

## 9. Conventions cheat-sheet

- **Path alias:** `#/*` → `src/*`.
- **Add a page:** new file under `routes/_app/`; add nav in `components/layout/nav.ts`; if role-restricted, add its path to `HQ_ONLY`/`BRANCH_ONLY` in `AppShell.tsx`.
- **Add a mutation:** function in `server/data.ts` (branch-scoped reads use `branchScope`; writes derive `branchId` from `ctx`) → wrapper in `server/fns.ts` → method in `store/store.tsx`.
- **Branch isolation** = `branchScope` in `server/scope.ts` (pure, unit-tested in `scope.test.ts`). Every branch-scoped read MUST pass through it — a forgotten `branchScope` is a leak; there's no DB RLS backstop anymore.
- **Money math:** always via `calc.ts`; never inline. Historical USD snapshots are never recalculated.
- **Never import** `db/`, `auth/server.ts`, `server/data.ts`, `server/ocr.ts`, or `server/storage.ts` from client code — they're server-only and must stay out of the browser bundle (verified: they land only in `.output/server/`).
- **Generated files** (`routeTree.gen.ts`) are never hand-edited.
```
