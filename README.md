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
| OCR | **Google Gemini** (server-side; key never reaches the browser) |
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
#    then edit .env — set BETTER_AUTH_SECRET (openssl rand -base64 32)
#    and GEMINI_API_KEY. The DB values already match docker-compose.

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

> **Note:** the Gemini OCR call runs server-side. If your network blocks Google, the dev server — running on your machine — needs a VPN to reach it. In production the call originates from the host, not the user's browser.

---

## Deploy (Coolify / any Node host)

`bun run build` produces a standalone **Nitro Node server** at `.output/server/index.mjs`. Coolify builds it with **Nixpacks** using the committed [`nixpacks.toml`](nixpacks.toml) — no Dockerfile required. The same output runs on any Node host (Railway, Render, a plain VPS).

> **This branch stores receipt images as base64 in the database** (no object storage), so deploy needs **only Postgres** — no S3 bucket. (The `main` branch moves receipts to S3/R2; deploy that instead if you expect many/large receipts, to avoid database bloat.)

**1. Provision Postgres** — a managed database (Coolify's one-click Postgres, or Neon / Supabase / RDS). Redis is **not** required (unused).

**2. Create the Coolify application** from this repo + branch. Nixpacks auto-detects it and uses `nixpacks.toml`: build `bun run build`, start `node .output/server/index.mjs`. Coolify injects `PORT`; the server binds `0.0.0.0`.

**3. Set environment variables** in Coolify (see `.env.example` for the annotated list):

| Var | Value |
|---|---|
| `DATABASE_URL` | app Postgres URL (limited role in prod) |
| `ADMIN_DATABASE_URL` | Postgres URL with DDL rights (migrations/seed) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | the app's **public** URL, e.g. `https://funding.example.org` |
| `OCR_PROVIDER` | `gemini` or `tesseract` |
| `GEMINI_API_KEY` | only when `OCR_PROVIDER=gemini` |

**4. Initialise the DB once** (Coolify app terminal, or locally with the prod env):

```bash
bun run db:push          # create the schema
bun run db:seed          # branches, categories, plans, demo expenses
bun run db:seed:users    # demo logins (password demo123) — change these after first login!
```

**5. Deploy** — Coolify builds and starts the server; open `BETTER_AUTH_URL`.

Gotchas:
- `BETTER_AUTH_URL` **must** equal the public URL or logins fail (session-cookie mismatch).
- `OCR_PROVIDER=gemini` needs outbound network to Google + the key; `tesseract` runs fully offline (English data is committed under `tessdata/`).

---

## Project standards

- **Branch isolation** — every branch-scoped query passes through `branchScope` (`src/lib/server/scope.ts`), a pure, unit-tested gate. There is no DB RLS backstop, so a forgotten `branchScope` is a leak.
- **Money math** — only via the branch ledger (`src/lib/ledger.ts`); never sum expenses inline. Cancelled transactions are excluded there. Historical USD snapshots are never recalculated.
- **Review transitions** — only via `src/lib/reviewLifecycle.ts`; the UI asks it which actions are available so it can't offer a move the server would reject.
- **Secrets** — never in client code. `GEMINI_API_KEY` and DB URLs are server-only; `.env` is gitignored (see `.env.example`).
- **Type safety** — TypeScript end to end; `tsc --noEmit` must stay clean.

---

## Two builds

- **`main` / `Win-branch`** — pure PostgreSQL; receipt images stored base64 in the DB. *(This README describes this build.)*
- **`backend-supabase-included`** — Supabase Postgres + a private Storage bucket for receipt images (adds `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).

---

*Internal tool. Maintained by Miaoen Chien.*
