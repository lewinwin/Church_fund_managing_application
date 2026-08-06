# Repo & Branch Map — 611 Ministry Funding

> Where the code lives and what each branch is for. **Last updated: 2026-08-06.**
> This project is pushed to **two GitHub remotes** with a deliberate branch layout.
> `main` on `origin` is the canonical, most-complete build.

---

## Remotes

| Remote | GitHub | Role |
|---|---|---|
| **`origin`** | `611bol/petty-cash` | Supervisor's org — shared with the manager. Deploy target. (You are not the owner, so Vercel can't be attached here.) |
| **`myrepo`** | `lewinwin/Church_fund_managing_application` | Your own repo — you control Vercel here. |

> **No live hosted instance right now.** The former live deploy (`backend-supabase-included` on Vercel + Supabase) was deleted and that deployment cancelled.

---

## Feature matrix (the differences that matter)

| Capability | Where it lives |
|---|---|
| **S3 receipt storage** (key in DB, private bucket, presigned URLs) | `origin/main`, `origin/feat/s3-storage` only |
| **Base64 receipt storage** (image in a DB column) | `Win-branch` (both remotes), older branches |
| **OCR switchable** (`OCR_PROVIDER` = gemini / tesseract) | `main`, `Win-branch`, `Tesseract-branch` |
| **Currency ISO codes** (`ZAR 640,00`, not `R 640,00`) | `main`, `Win-branch`, `Tesseract-branch`, `feat/s3-storage` |
| **Expand all / Collapse all** on the receipts list | `main`, `Win-branch`, `feat/s3-storage` |
| **Coolify / Nixpacks deploy docs** (`nixpacks.toml`) | `main`, `Win-branch`, `feat/s3-storage` |

---

## `origin` — `611bol/petty-cash`

| Branch | What it is | Status |
|---|---|---|
| **`main`** | **Canonical full-backend build** and the recommended deploy target. Postgres + Drizzle + Better Auth, OCR switchable, **S3 receipt storage**, currency ISO codes, expand/collapse, Coolify deploy docs. | ✅ current |
| `Win-branch` | Full backend but **base64 receipt storage** (no S3) — behind `main`. Has OCR switchable + currency + expand/collapse + deploy docs. | Behind `main` (no S3) |
| `feat/s3-storage` | The S3-storage feature branch, merged into `main` (PR #40). ≈ `main`. | Merged / historical |
| `feat/ocr-provider` | The `OCR_PROVIDER` abstraction feature branch, merged into `main`. | Merged / historical |
| `Tesseract-branch` | **Tesseract-only** OCR build (fully local, no Gemini) — images + PDF text/render. Has currency codes. | Active variant |
| `Tesseract-branch-testing` | Throwaway branch holding a user-testing plan / intro doc. | Scratch |
| `Germini-API-version` | Preserved **Gemini-only** version (snapshot before the `OCR_PROVIDER` switch). | Archive |
| `Win-UI-only` | **UI-only** (localStorage) demo copy — no backend. | Demo |

## `myrepo` — `lewinwin/Church_fund_managing_application`

| Branch | What it is | Status |
|---|---|---|
| **`main`** | **UI-only, localStorage** demo (was Vercel Project 1 — always-on demo, no DB). | Demo |
| `Win-branch` | Full backend, **base64 receipt storage**. Has currency + expand/collapse. | Behind `origin/main` (no S3) |
| `Tesseract-branch` | Tesseract-only OCR build. Has currency codes. | Active variant |
| `Win-UI-only` | UI-only demo copy, synced to latest UI. | Demo |
| `Original-pure-Postgresql` | Original pure-Postgres backend snapshot. | Archive |
| `fix/pdf-receipt-expand` | PDF-expand feature branch. | Merged / historical |

---

## Which branch do I use?

- **Deploy / hand to the manager →** `origin/main` (most complete: S3 storage, switchable OCR, deploy docs).
- **Run the always-on UI demo (no DB) →** `myrepo/main` (UI-only).
- **Local-only OCR, no API key →** any `Tesseract-branch`, or set `OCR_PROVIDER=tesseract` on `main`.
- **Legacy backend without object storage →** `Win-branch` (kept for reference; `main` supersedes it).

> `push`/`pull` targets a specific remote **and** branch — state the exact `remote/branch` before pushing. "Deploy" = `origin/main`; "UI demo" = `myrepo/main`.
