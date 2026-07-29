# ARCHITECTURE — 611 Ministry Funding

> **Purpose:** A precise map of the codebase for fast orientation mid-task (human or AI). Where each folder/file lives, what it's responsible for, and how one request travels end-to-end.
> **Audience:** future-me / AI assistant reference — dense and complete, not a tutorial.
> **Last verified against source:** 2026-07-23.
> **Two builds:** `main` / `Win-branch` (pure PostgreSQL, receipt images stored base64 in the DB) and `backend-supabase-included` (Supabase Postgres + a private Storage bucket for images). This doc describes the pure build; the few Supabase-only parts are flagged.

---

## 1. The one-paragraph model

A **TanStack Start** app (React 19 + Nitro + Vite). File-based routes render React pages that read data through two providers — `AuthProvider` and `StoreProvider`. Those providers never touch the database directly; they call **server functions** (`createServerFn`), which run on the server, resolve the Better-Auth session, and query **PostgreSQL** via **Drizzle ORM**. Branch isolation is applied in **application code** by a pure, testable helper — `branchScope(ctx, col)` adds `WHERE branch_id = …` for branch users (nothing for HQ) — so the browser can never fetch another branch's rows.

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
                                lib/server/data.ts  (mappers + queries + mutations)
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
│   ├── components/      Presentational + composite UI, grouped by domain.
│   ├── lib/             All non-UI logic: auth, db, server fns, calc, ledger, review lifecycle, format.
│   ├── data/            Seed JSON (source for scripts/seed.ts).
│   ├── router.tsx       TanStack Router factory + type registration.
│   ├── routeTree.gen.ts GENERATED route tree (do not edit by hand).
│   └── styles.css       Tailwind entry + theme tokens.
├── scripts/            DB lifecycle: seed, seed-users, drop-rls, verify.
├── docs/               This file.
└── <root configs>      package.json, drizzle.config.ts, vite.config.ts, biome.json, …
```

---

## 3. `src/routes/` — URLs, pages, guards

File-based routing: the file path *is* the URL. `_` prefixes a **pathless layout** route; `$` marks a **dynamic param**.

| File | URL | Responsibility |
|---|---|---|
| `__root.tsx` | — | Root document. Sets the browser title. Mounts providers: `<AuthProvider><StoreProvider>…`. Order matters — the store depends on who's logged in. |
| `index.tsx` | `/` | Redirects: HQ → `/branches`, branch → `/dashboard`, signed-out → `/login`. |
| `login.tsx` | `/login` | Login form + demo-account quick-fill. Brand panel shows a **live branch count** (`branchCountFn`, public). |
| `forgot-password.tsx` / `reset-password.tsx` | | **UI-only mock — not wired to any backend.** There is no working self-service reset; the only real password change is in Settings. |
| `_app.tsx` | — | Pathless layout → renders `AppShell` (sidebar + topbar + guards) around all authenticated pages. |
| `_app/dashboard.tsx` | `/dashboard` | **Branch users only** → `BranchDashboard`. **HQ has no dashboard** — it redirects to `/branches`. |
| `_app/submit-receipt.tsx` | `/submit-receipt` | Branch only. Manual entry + receipt upload → `addExpense` → fires background `verifyExpense`. **No OCR pre-fill** (OCR now audits *after* submit — see §7). |
| `_app/expenses.tsx` | `/expenses` | Branch "My Receipts" — fund balance (local currency) + Month→Day receipt accordion. |
| `_app/reports.tsx` | `/reports` | Filters + CSV/PDF export. Summary tiles in local currency when scoped to one branch. |
| `_app/settings.tsx` | `/settings` | Account + branch info + **Change password** (Better Auth). |
| `_app/branches/index.tsx` | `/branches` | HQ landing: all-branches list (local currency per row) + cross-branch **"Needs Check"** review queue. HQ only. |
| `_app/branches/$branchId.tsx` | `/branches/:id` | HQ: one branch's detail (all figures in the branch's local currency). HQ only. |
| `_app/funding-plans.tsx` | `/funding-plans` | HQ: plans + record fund release + add-to-target. Money entered/shown in local currency. HQ only. |
| `_app/categories.tsx` | `/categories` | HQ: category management. HQ only. |
| `_app/users.tsx` | `/users` | HQ: users + **create branch** (branch row + login account + currency + fixed rate). HQ only. |

**Guards live in [`components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx), not in the routes.** `HQ_ONLY` / `BRANCH_ONLY` path lists + a `useEffect` redirect enforce role boundaries even against a hand-typed URL. The shell shows a full-screen loader until `auth.ready && store.hydrated`.

---

## 4. `src/components/` — UI, grouped by domain

| Folder | Contents | Notes |
|---|---|---|
| `ui/` | `primitives.tsx` (Button, Card, Field, Input, Select, SectionCard, Badge, StatusPill, ProgressBar, EmptyState, `cx`), `StatCard.tsx`, `DataTable.tsx`, `Overlay.tsx` (Modal + Drawer; Drawer has an optional `aside` side-panel slot) | Design-system building blocks. |
| `layout/` | `AppShell.tsx` (shell + **guards** + mobile FAB), `Sidebar.tsx`, `TopBar.tsx`, `nav.ts` (role→nav-items; HQ has no Dashboard item) | The frame around every authenticated page. |
| `dashboard/` | `BranchDashboard.tsx`, `FundOverview.tsx` (released/spent/remaining block, reused on the receipts page), `CategoryDonutCard.tsx` (presentational — takes pre-aggregated ledger slices), `RecentExpenses.tsx` | HQ dashboard was removed. |
| `receipts/` | `GroupedExpenseList.tsx` (Month→Day→txn accordion, with per-group ⚠ flag counts), `ExpenseDetailDrawer.tsx`, `ReceiptPreview.tsx` (image + zoom lightbox), `ReviewBadge.tsx`, `ReviewPanel.tsx` (HQ decision panel), `HqReviewCard.tsx` (queue card = header + ReviewPanel), `EditExpenseForm.tsx` (branch correction form), `ExpenseTable.tsx` | The OCR-review + correction UI. |
| `funding/` | `EditPlanModal.tsx`, `FundReleaseModal.tsx` | HQ funding actions (local-currency input). |
| `charts/` | `DonutChart.tsx`, `BarChart.tsx` | Presentational SVG charts. |

**Convention:** components are presentational and receive data via props; pages (in `routes/`) pull from `useStore()` / `useAuth()` and pass it down.

---

## 5. `src/lib/` — the logic layer

### Data + backend
| File | Responsibility |
|---|---|
| `db/schema.ts` | Drizzle schema — 9 tables (4 Better-Auth: `user`/`session`/`account`/`verification`; 5 domain: `branches`/`expense_categories`/`funding_plans`/`fund_releases`/`expenses`). `user` has extra `role`+`branchId`; `branches` has `local_currency`+`exchange_rate_to_usd`; `expenses` has `review_status`/`review_note`/`modify_count` + `ocr_raw` jsonb. |
| `db/client.ts` | `postgres.js` connection (`DATABASE_URL`, the limited `petty_app` role) + Drizzle instance. Server-only. |
| `auth/server.ts` | Better Auth config — email/password, hashed, `role`/`branchId` custom fields. Server-only. |
| `auth/ctx.ts` | `getAuthCtx()` / `requireAuthCtx()` — resolve the cookie session → `{ userId, role, branchId }`. |
| `auth/auth.tsx` | **Client** `AuthProvider` / `useAuth()`. Mirrors the cookie session into React state. `login` is async → `{ ok, error? }`. |
| `server/scope.ts` | **Branch-isolation gate:** `branchScope(ctx, col)` → Drizzle `WHERE` (undefined for HQ), `canWriteBranch`. Pure + the `AuthCtx` type. Unit-tested (`scope.test.ts`) — no DB. |
| `server/data.ts` | The data layer: row↔domain mappers, `getBootstrapData(ctx)` (reads gated by `branchScope`), `getBranchCount()` (public), and every mutation. Sensitive fields (branchId, submitter) derive from `ctx`, never the client. Review transitions go through the lifecycle (§7); money is never summed here. |
| `server/ocr.ts` | **Local receipt reading** — no API key, no network. `runReceiptVerification(dataUrl)` reads the receipt from whichever source fits: **image via Tesseract** (shared worker, bundled `tessdata/eng.traineddata`) or **digital PDF via its text layer** (`pdfText.ts`), then via `receiptParse.ts` returns `{ocrAmount, ocrDate, …}`. Category is neutralised (`categoryFits = 1`): no semantic model, so HQ judges category; scanned PDFs with no text layer route to review. Server-only; never throws. |
| `server/pdfText.ts` | **Digital-PDF text extraction** — `extractPdfText(dataUrl)` pulls a born-digital PDF's text layer via `unpdf` (serverless pdf.js; offline, exact). Returns null for non-PDFs or scanned PDFs (no text layer). Server-only; never throws. |
| `server/receiptParse.ts` | **Pure receipt-text parsing** — `parseReceiptFields(text)` → `{amount, date, amountLabeled}` from raw receipt text, whatever the source (prefers a labelled total over subtotal/line items; `parseMoney` copes with dot/comma/space conventions; `parseReceiptDate` handles ISO/day-first/month-name). No I/O. Unit-tested (`receiptParse.test.ts`). |
| `server/verify.ts` | **Pure OCR comparison** — `compareReceipt(entered, ocr)` → `{amountMatch, dateMatch, categoryOk, needsCheck}` (amount/date exact, category by confidence threshold). No DB. |
| `server/fns.ts` | The RPC API — `createServerFn` wrappers the client calls. Auth: `getSessionFn`/`signInFn`/`signOutFn`. Data: `bootstrapFn`, `branchCountFn`, one fn per mutation, plus the review fns (`verifyExpenseFn`, `cancelExpenseFn`, `requestModifyFn`, `confirmModificationFn`, `updateExpenseFieldsFn`). |
| `store/store.tsx` | **Client** `StoreProvider` / `useStore()`. Loads `bootstrapFn()` on login; each mutation calls a server fn then `refresh()`. |

### Pure logic + utilities (role-agnostic, no I/O)
| File | Responsibility |
|---|---|
| `ledger.ts` | **The single home for a Branch's money.** `ledgerFor(data, branchId)` → released/spent/remaining/target (USD *and* local) + `byCategory`, all with **cancelled Expenses excluded** internally. `spentUsdOf(expenses)` totals an arbitrary subset (Reports); `globalLedger(data)` is the HQ-wide total. Never hands a raw array back to be summed. Tested in `ledger.test.ts`. |
| `reviewLifecycle.ts` | **The single home for the OCR-review state machine.** A declarative `TRANSITIONS` table drives `availableActions(status, actor)` (which buttons show), `applyAction(status, action, actor)` (→ next status or a rejection — the one transition guard), `isResolved` / `needsAction`, and `nextStatusAfterVerify`. Both `data.ts` and the review UI read it. Tested in `reviewLifecycle.test.ts`. |
| `ocrCheck.ts` | The **typed OCR verification record** (`OcrCheck`) + `parseOcrCheck` (the one reader). Persisted in the `ocr_raw` jsonb column, written/read only through this module, surfaced as `Expense.ocrCheck`. |
| `calc.ts` | Selectors + non-money derivations: `expensesForBranch` (display) vs `fundableExpenses` (money), `releasesForBranch`, `activePlanForBranch`, `spendByCategory`, `balanceStatus`, category/lookup helpers. Money aggregates moved to `ledger.ts`. |
| `types.ts` | Domain types (`Expense`, `Branch`, `ReviewStatus`, `CurrencyCode`, `AppData`, …) shared client+server. |
| `format.ts` | `formatMoney` / `formatAmount` (no symbol) / `formatUsd` / `formatPercent` / dates. Decimal places come from `Intl` per currency (VND→0, THB→2), with MWK/CRC overridden to 0. |
| `currency/exchangeRate.ts` | Fixed per-branch FX. `toUsd` / `usdToLocal`; `rateForCurrency(currency, branches)` prefers the owning branch's rate (never a silent 1.0); `availableCurrencies(own, branches)` lists every branch's currency + the built-ins. Tested in `exchangeRate.test.ts`. |
| `export.ts` | CSV builder + `printReport` (PDF via print). |
| `id.ts` | ID generation. |

*(Supabase build only: `server/storage.ts` — receipt images → a private Supabase Storage bucket, with `receiptUrlFn` for signed view URLs. The pure build omits it and keeps base64 in the DB.)*

---

## 6. `scripts/` + root config

| File | Role |
|---|---|
| `scripts/seed.ts` | Seeds domain tables from `src/data/*.json` (`bun run db:seed`); seed expenses are inserted as `review_status = 'ok'`. |
| `scripts/seed-users.ts` | Creates the 5 Better-Auth accounts, hashed (`bun run db:seed:users`). |
| `scripts/drop-rls.sql` | Disables RLS + drops the old per-branch policies (isolation now lives in `scope.ts`). |
| `scripts/verify-data.ts` | Proves isolation through the app's own `getBootstrapData()`. |
| `scripts/ocr-smoke.ts` | Offline OCR sanity check (`bun run ocr:smoke`) — reads `scripts/fixtures/sample-receipt.png` with the bundled Tesseract data. |
| `scripts/pdf-smoke.ts` | Offline PDF text-layer check (`bun run pdf:smoke`) — reads `scripts/fixtures/sample-receipt.pdf` via `unpdf`. |
| `tessdata/eng.traineddata` | Bundled Tesseract English data (committed, ~4 MB) — loaded locally by `server/ocr.ts`; no CDN. |
| `drizzle.config.ts` | drizzle-kit target — uses `ADMIN_DATABASE_URL` (owner role) for `db:push` / `db:studio`. |
| `vite.config.ts` | TanStack Start + Vite plugins; `#/*` path alias → `src/*`. |
| `biome.json` | Lint/format — tabs, double quotes. |
| `.env` (gitignored) | `DATABASE_URL` (app), `ADMIN_DATABASE_URL` (owner), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`; Supabase build also `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. **OCR is local — no key.** |

**Two DB roles:** migrations/seed run as owner `postgres`; the app runs as the limited `petty_app` (row DML, no DDL). Isolation is `branchScope` in app code, not RLS — the limited role is least-privilege only.

---

## 7. The OCR verification workflow

OCR is a **post-submission auditor**, not a data-entry helper. See [`OCR_VERIFY_DESIGN.md`](../../OCR_VERIFY_DESIGN.md) (repo root) for the full spec.

1. The branch **types every field manually** and uploads the receipt → the row is saved as `checking`, submit is instant.
2. The browser fires **`verifyExpense`**: `server/ocr.ts` reads the receipt, `server/verify.ts` compares it to the entered amount/date/category, and the result is stored as a typed **`OcrCheck`** (`ocrCheck.ts`). The lifecycle routes it to `ok` (silent) or **`need_check`** (flagged). OCR never decides an outcome — it only flags.
3. HQ resolves a flag from the receipt detail or the Branches "Needs Check" queue: **Cancel** / **Modify** / **Correct** (HQ's decision outranks OCR). A Modify returns it to the branch, which corrects the typed fields (`EditExpenseForm`) → re-verify → **`after_modify_check`** → HQ **Correct** → `correct_modification`.

**Statuses** (`ReviewStatus`): `checking · ok · need_check · cancelled · modify_requested · after_modify_check · correct_modification`. Only `cancelled` is excluded from balances (the ledger owns that rule). Every legal transition — and which actor may make it — is the `TRANSITIONS` table in `reviewLifecycle.ts`; the UI asks `availableActions` so it can never offer a move the server would reject.

---

## 8. Request lifecycle — one submission, end to end

**"A Singapore branch user submits a receipt":**

1. **`routes/_app/submit-receipt.tsx`** — user uploads an image and types the details → `useStore().addExpense(input)`. The rate is resolved via `currency/exchangeRate.ts`; the input carries *no* branchId.
2. **`store/store.tsx`** — `addExpense` calls `submitExpenseFn({ data })`, returns the new id, then fires `verifyExpense(id)` (background).
3. **`server/fns.ts` → `auth/ctx.ts`** — `requireAuthCtx()` validates the cookie session → `{ userId, role:'branch_user', branchId:'br-sg' }`.
4. **`server/data.ts`** — `submitExpense(ctx, input)` sets `branchId = ctx.branchId` (server-derived) and `review_status` defaults to `checking`. Plain Drizzle `INSERT` as `petty_app`.
5. **`verifyExpense(id)`** — loads the row + receipt, runs `runReceiptVerification` (`server/ocr.ts`) + `compareReceipt` (`server/verify.ts`), writes a typed `OcrCheck`, and sets the status via `nextStatusAfterVerify` (`ok` / `need_check`).
6. Back in **`store/store.tsx`** — `refresh()` → `bootstrapFn()` re-reads branch-scoped data → React re-renders.

**Read path:** on login `StoreProvider` calls `bootstrapFn()` → `getBootstrapData(ctx)` → each branch-scoped read runs `.where(branchScope(ctx, table.branchId))` → a branch user gets only their rows; HQ gets all.

---

## 9. Conventions cheat-sheet

- **Path alias:** `#/*` → `src/*`.
- **Add a page:** new file under `routes/_app/`; add nav in `components/layout/nav.ts`; if role-restricted, add its path to `HQ_ONLY`/`BRANCH_ONLY` in `AppShell.tsx`.
- **Add a mutation:** function in `server/data.ts` (branch-scoped reads use `branchScope`; writes derive `branchId` from `ctx`) → wrapper in `server/fns.ts` → method in `store/store.tsx`.
- **Branch isolation** = `branchScope` in `server/scope.ts` (pure, unit-tested). Every branch-scoped read MUST pass through it — there is no DB RLS backstop.
- **Money math** = `ledger.ts` only; never sum expenses inline. The cancelled-exclusion rule lives there. Historical USD snapshots are never recalculated.
- **Review transitions** = `reviewLifecycle.ts` only; never hand-code status checks. The UI reads `availableActions`.
- **The OCR check** is the typed `OcrCheck` (`ocrCheck.ts`); never re-parse `ocr_raw` at a call site.
- **Never import** `db/`, `auth/server.ts`, `server/*` from client code — server-only, must stay out of the browser bundle.
- **Generated files** (`routeTree.gen.ts`) are never hand-edited.
```
