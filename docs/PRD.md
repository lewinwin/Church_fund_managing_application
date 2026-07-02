# PRD — 611 Petty Cash Management System

> Product requirements for v1. Authority order: [`../../context.md`](../../context.md) > [`../README.md`](../README.md) > this doc.
> Week 1 status: UI-first prototype on mock data (localStorage). No real auth/DB/OCR/FX yet.

---

## 1. Problem & Goal

Church branches in 4 countries manage petty cash manually — receipts collected in person, totals by hand, reports to HQ late and inconsistent, each branch in a different local currency. HQ has no real-time view of spending or balances.

**Goal:** a centralized web app where branch users submit petty-cash expenses in real time (OCR-assisted), see their own balance in local currency, and HQ sees all branch spending and balances consolidated in USD.

---

## 2. Roles & Access

| Role | Scope | Key capabilities |
|---|---|---|
| **HQ Admin** | All branches | Consolidated USD dashboard, branch drill-down, funding plans, fund releases, categories, users, all-branch reports |
| **Branch User** | Own branch only | Upload receipts, review OCR, submit expenses, view own balance/receipts, export own report |

**Data-isolation contract (mirrors production RLS):** every data read is scoped by `role` + `branchId`. A Branch User can never load another branch's expenses; HQ bypasses the branch filter. Enforced in the app at [`src/lib/calc.ts`](../src/lib/calc.ts) (`visibleExpenses`, `canAccessBranch`, `expensesForBranch`) and by route guards in [`src/components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx).

### Demo accounts (password `demo123`)

| Email | Role |
|---|---|
| `hq@example.com` | HQ Admin |
| `singapore@example.com` | Branch User — Singapore (SGD) |
| `malawi@example.com` | Branch User — Malawi (MWK) |
| `southafrica@example.com` | Branch User — South Africa (ZAR) |
| `costarica@example.com` | Branch User — Costa Rica (CRC) |

---

## 3. Branches & Currency

Each branch has a fixed local currency. HQ views everything in USD.

| Branch | Currency | Mock rate (1 local → USD) |
|---|---|---|
| South Africa | ZAR | 0.0556 |
| Malawi | MWK | 0.000578 |
| Singapore | SGD | 0.741 |
| Costa Rica | CRC | 0.00196 |

**Currency rules**

- On submission the expense stores: local amount, local currency, exchange rate to USD, and computed USD equivalent.
- The exchange rate is **snapshotted at entry time** and never recalculated when rates change.
- Branch balance is displayed in local currency using the *current* rate for display only; stored historical USD amounts are preserved.
- W1 uses fixed rates in [`src/lib/currency/exchangeRate.ts`](../src/lib/currency/exchangeRate.ts). The `getExchangeRateToUsd` interface matches the future live provider, so W3 swaps the internals only.

---

## 4. Receipt Submission Flow

1. Branch User uploads a receipt (JPG / PNG / HEIF / PDF).
2. App shows an OCR processing state.
3. Mock OCR ([`src/lib/ocr/ocrService.ts`](../src/lib/ocr/ocrService.ts)) returns amount, currency, date, merchant + confidence — or, on the "simulate failure" path, empty fields.
4. Form is pre-filled; the user reviews and corrects any field. **Human correction is the source of truth.**
5. User selects a primary category. If **Other**, a sub-category dropdown is required.
6. On submit, the rate is looked up, USD is computed and snapshotted, and the expense is saved to localStorage.
7. The branch dashboard, receipts list, and HQ consolidated totals update immediately.

**OCR failure handling:** fields default to empty, the user fills them manually, and submission is never blocked because OCR failed.

---

## 5. Funding Plan Lifecycle

1. HQ creates one **active** funding plan per branch (branch, total target USD, description, status).
2. HQ records fund releases / tranches (amount USD, release date, optional note).
3. Balances:

   ```text
   released_usd  = sum(fund_releases.amount_usd)      // per branch
   spent_usd     = sum(expenses.usd_amount)           // per branch
   remaining_usd = released_usd - spent_usd
   ```

4. Recording a release increases released + remaining (available) balance. It records the release only — no real bank transfer.
5. Branch User sees remaining balance converted to local currency.

**Balance status** (remaining ÷ released): `low` ≤ 15%, `warning` ≤ 35%, else `healthy`.

---

## 6. Categories

- Global, HQ-managed, shared across all branches.
- Two-level only: primary categories, plus sub-categories **under "Other" only**.
- Active/inactive. Branch Users can select **active** categories only.
- Selecting "Other" as primary makes the sub-category **required**.

---

## 7. Pages

**Auth:** Login · Forgot Password (UI-only) · Reset Password (UI-only)

**Branch User:** Dashboard · Upload Receipt · My Receipts (list + detail drawer + receipt preview) · Reports/Export · Settings

**HQ Admin:** HQ Dashboard · Branches · Branch Detail · Funding Plans · Categories · Users · Reports/Export · Settings

Navigation is role-based ([`src/components/layout/nav.ts`](../src/components/layout/nav.ts)) — users never see links they cannot access.

---

## 8. Data Model (mock mirrors production)

`branches`, `users`, `expense_categories`, `expenses`, `funding_plans`, `fund_releases` — see [`src/lib/types.ts`](../src/lib/types.ts) and seed data in [`src/data/`](../src/data/). All persistence goes through a single repository layer ([`src/lib/store/persistence.ts`](../src/lib/store/persistence.ts)) so W2 swaps localStorage for Drizzle/Postgres without touching the UI.

---

## 9. Export

Both roles export their in-scope report as **CSV** (download) and **PDF** (browser print dialog). HQ can additionally filter by branch and choose a USD / local / both currency view. See [`src/lib/export.ts`](../src/lib/export.ts).

---

## 10. Security (design intent; enforced for real in W2+)

- No shared HQ Admin password; Branch User account may be shared per branch.
- Branch users never access other branch data; every query is branch-scoped.
- Row-Level Security at the DB layer; receipt files in a private bucket, authorized roles only.
- API keys / DB credentials never client-side; privileged operations server-side only.

---

## 11. Out of Scope (v1)

Multi-step approval workflow · multiple active plans per branch · native mobile app · accounting integrations · historical FX recalculation · per-branch categories.

---

## 12. Definition of Done — v1 Pilot

HQ + one Branch User can log in · Branch User uploads a receipt, OCR pre-fills or gracefully falls back to manual · expense stored with local + USD + rate + category + file · branch dashboard balance updates · HQ dashboard shows the branch's released/spent/remaining in USD · branch data isolation enforced · app deployed and accessible to the pilot branch.
