# 611 Ministry Funding

> Internal expense tracking tool for church branches — receipt upload with OCR, multi-currency support, and staged funding oversight for headquarters.

---

## What This Does

Branches upload receipts. HQ sees where the money went.

**Branches** upload receipt photos or PDFs, confirm OCR-extracted details, categorize expenses, and monitor their remaining fund balance in local currency.

**Headquarters** manages funding plans per branch, defines expense categories, and views all branch activity consolidated in USD.

---

## Roles

| Role | Scope | Can Do |
|---|---|---|
| HQ Admin | All branches | Manage funding plans, define categories, view global USD report |
| Branch User | Own branch | Upload receipts, confirm OCR, select category, monitor fund balance |

Each branch has one shared account (Branch User).

---

## Branches & Currencies

| Branch | Currency |
|---|---|
| South Africa | ZAR |
| Malawi | MWK |
| Singapore | SGD |
| Costa Rica | CRC |

HQ views all figures converted to USD. Branches view their own local currency.

---

## Funding Plan

Each branch has one active funding plan at a time. HQ sets a total target and releases funds in stages based on spending progress.

```
Funding Plan (per branch)
 ├─ Total target:    $100,000 USD
 ├─ Released so far:  $20,000 USD  (Stage 1)
 ├─ Spent so far:     $12,300 USD  (converted from local currency)
 └─ Remaining:         $7,700 USD  ← HQ monitors this to trigger next release
```

HQ manually inputs each fund release into the system.

---

## Expense Categories

Defined by HQ, shared across all branches. Two-level structure — only the **"Other"** category has sub-categories.

```
Categories
 ├─ Meals & Hospitality
 ├─ Transportation
 ├─ Stationery & Supplies
 ├─ Other
 │    ├─ Venue Rental
 │    ├─ Equipment Repair
 │    └─ (more sub-categories as needed)
 └─ ...
```

When a submitter selects "Other", a second dropdown appears for the sub-category.

---

## Receipt Flow

```
Submitter uploads photo / PDF
  → OCR extracts amount, date, merchant
  → Submitter reviews and corrects if needed
  → Submitter selects category (+ sub-category if "Other")
  → Receipt visible to Branch Leader
  → Receipt visible to HQ (amount converted to USD)
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start |
| Auth | Better Auth + organization plugin |
| State / Query | TanStack Query |
| Router | TanStack Router |
| Form / Validation | TanStack Form + Zod |
| UI / Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL (Supabase / Neon) + Drizzle ORM |
| Deployment | Coolify |
| Formatting | Biome |
| Pre-commit | Husky + lint-staged |
| Testing | `bun test` (unit/integration) + Playwright (E2E) |

---

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Start development server
bun run dev

# 3. Run quality checks (Biome)
bun run check
```

---

## Week 1 Status — UI-First Prototype

Week 1 ships a clickable, role-aware **UI prototype running entirely on mock data** (seed JSON → `localStorage`). No real Better Auth, Supabase, OCR, or exchange-rate APIs yet — those land W2–W3. See [`../WEEK1_PLAN.md`](../WEEK1_PLAN.md) for the full plan.

**Demo accounts** (all password `demo123`):

| Email | Role |
|---|---|
| `hq@example.com` | HQ Admin |
| `singapore@example.com` | Branch User — Singapore |
| `malawi@example.com` | Branch User — Malawi |
| `southafrica@example.com` | Branch User — South Africa |
| `costarica@example.com` | Branch User — Costa Rica |

All data lives in your browser. Use **Reset demo data** (Settings) to restore seed state.

---

## Roadmap

| Week | Phase | Deliverables |
|---|---|---|
| W1 | Requirements & Design | UI prototype + requirements + mockups |
| W2 | Foundation & Auth | Project setup, Better Auth, RLS, role setup |
| W3 | OCR Integration | OCR API + receipt upload pipeline |
| W4 | Core Features | Expense entry, category selector, fund balance view |
| W5 | HQ Dashboard | USD consolidation, funding plan management |
| W6 | Testing & Deploy | Unit/E2E tests, Coolify setup, UAT |

---

## Project Standards

**Type safety** — End-to-end via Zod + TypeScript. No `any`.

**Data isolation** — Every query scoped by `organization_id`. Enforced at RLS layer.

**Currency handling** — Store all amounts in original local currency + USD equivalent at time of entry. Never recalculate historical records when exchange rates change.

**Data security** — No secrets in client-side code. Server Actions only for privileged operations.

**Export** — Receipt data and reports designed for CSV/Excel/PDF export.

---

*Internal tool. Maintained by Miaoen Chien.*
