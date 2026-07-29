# 611 Ministry Funding

> Internal petty-cash tool for church branches — manual expense entry with **OCR receipt verification**, per-branch multi-currency, and staged funding oversight for headquarters.

---

## What it does

Branches record their spending; HQ oversees the money and audits it against the receipts.

- **Branch users** enter each transaction manually and upload the receipt. After submission, OCR checks the receipt against what they typed; anything that doesn't match is flagged for HQ. They track their remaining fund balance in their own local currency.
- **HQ admins** create branches (with a login + currency + exchange rate), manage funding plans, define categories, review flagged transactions, and see every branch's activity.

For the full technical map, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Roles

| Role | Scope | Can do |
|---|---|---|
| **HQ Admin** | All branches | Create branches + login accounts, set funding plans & fund releases, define categories, review/cancel/return flagged transactions |
| **Branch User** | Own branch | Submit receipts, correct returned transactions, change own password, monitor fund balance |

Each branch has one shared Branch User account. Isolation is enforced in application code (`branchScope`) — a branch user can never read another branch's data.

---

## Branches & currencies

Seed branches:

| Branch | Currency |
|---|---|
| Singapore | SGD |
| Malawi | MWK |
| South Africa | ZAR |
| Costa Rica | CRC |

HQ can create **new branches with any currency at runtime** (e.g. VND, THB) by entering a fixed exchange rate. Amounts are stored in **USD** internally (snapshotted at entry time, never recalculated); the UI shows each branch's **local currency**, and HQ Reports can also total in USD for cross-branch comparison.

---

## Funding plans

Each branch has one active funding plan. HQ sets a target and records fund releases (top-ups) in stages as the branch spends.

```
Funding plan (per branch)
 ├─ Target           (HQ can "Add" to it without creating a new plan)
 ├─ Released so far  (sum of recorded fund releases)
 ├─ Spent so far     (fundable expenses — cancelled ones excluded)
 └─ Remaining        ← HQ monitors this to decide the next release
```

Fund releases and targets are entered in the branch's local currency.

---

## Expense categories

Defined by HQ, shared across branches. Two-level — only **"Other"** carries sub-categories:

```
Meals & Hospitality · Transportation · Electricity Charges · … · Other ─┬─ Venue Rental
                                                                        ├─ Equipment Repair
                                                                        └─ …
```

Selecting "Other" reveals a sub-category dropdown.

---

## OCR receipt verification

OCR is a **post-submission auditor**, not a data-entry helper.

```
Branch types the details + uploads the receipt   →   saved as "Checking"
        │
        ▼  (background) OCR reads the receipt and compares amount / date / category
   ┌────────────┬──────────────────────────────────────────────┐
   │  matches   │  mismatch or low confidence                   │
   ▼            ▼                                                │
 shows normally   flagged "Need to Check" for HQ                │
                    │                                           │
                    ▼  HQ decides (its call overrides OCR)      │
        ┌───────────┼─────────────────────┐                    │
     Cancel      Modify                 Correct                 │
   (excluded    (back to branch →      (approve as-is)          │
    from        correct → re-check →                            │
    balance)    HQ confirms)                                    │
```

OCR only ever **flags**; every Cancel / Modify / Correct is a human HQ decision. Cancelled transactions are retained (audit trail) but excluded from balances. The whole state machine lives in one place (`src/lib/reviewLifecycle.ts`).

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **TanStack Start** (React 19 + Nitro + Vite) |
| Routing | TanStack Router (file-based) |
| Auth | **Better Auth** (email/password, hashed; `role` + `branchId` fields) |
| Data | Server functions (`createServerFn`) — no separate API layer |
| Database | **PostgreSQL** + **Drizzle ORM** (postgres.js driver) |
| OCR | **Tesseract** (image receipts) + **unpdf** (digital-PDF text layer) — local, no API key, no network |
| UI | Tailwind CSS + lucide-react icons + custom primitives |
| Testing | **Vitest** (+ Testing Library) |
| Format / lint | **Biome** (tabs) |
| Deployment | Vercel |

State is provided by two React contexts — `AuthProvider` and a custom `StoreProvider` that loads data via server functions and refetches after each mutation.

---

## Setup

Requires [Bun](https://bun.sh) and Docker (for local Postgres + Redis).

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env
#    then edit .env — set BETTER_AUTH_SECRET (openssl rand -base64 32).
#    The DB values already match docker-compose; OCR needs no key.

# 3. Start backing services (Postgres + Redis)
docker compose up -d

# 4. Create the schema and seed demo data
bun run db:push          # apply the Drizzle schema
bun run db:seed          # seed branches, categories, plans, expenses
bun run db:seed:users    # create the demo login accounts (password: demo123)

# 5. Start the dev server
bun run dev              # http://localhost:3000
```

Quality gates: `bun run check` (Biome) · `bunx tsc --noEmit` · `bun run test` · `bun run build`.

**Demo logins** (all password `demo123`): `hq@example.com` (HQ) · `singapore@example.com` · `malawi@example.com` · `southafrica@example.com` · `costarica@example.com` (branches).

> **Note:** Receipt reading runs **locally** — no API key, no network. **Image** receipts are OCR'd via Tesseract (bundled English data); **digital PDFs** are read via their text layer (`unpdf`, exact — no OCR). Either way it extracts the **amount and date** and flags mismatches against what the branch typed; **category is judged manually by HQ** (there is no semantic model). **Scanned** PDFs (no text layer) route straight to review. Sanity-check with `bun run ocr:smoke` and `bun run pdf:smoke`.

---

## Project standards

- **Branch isolation** — every branch-scoped query passes through `branchScope` (`src/lib/server/scope.ts`), a pure, unit-tested gate. There is no DB RLS backstop, so a forgotten `branchScope` is a leak.
- **Money math** — only via the branch ledger (`src/lib/ledger.ts`); never sum expenses inline. Cancelled transactions are excluded there. Historical USD snapshots are never recalculated.
- **Review transitions** — only via `src/lib/reviewLifecycle.ts`; the UI asks it which actions are available so it can't offer a move the server would reject.
- **Secrets** — never in client code. DB URLs and `BETTER_AUTH_SECRET` are server-only; `.env` is gitignored (see `.env.example`).
- **Type safety** — TypeScript end to end; `tsc --noEmit` must stay clean.

---

## Two builds

- **`main` / `Win-branch`** — pure PostgreSQL; receipt images stored base64 in the DB. *(This README describes this build.)*
- **`backend-supabase-included`** — Supabase Postgres + a private Storage bucket for receipt images (adds `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).

---

*Internal tool. Maintained by Miaoen Chien.*
