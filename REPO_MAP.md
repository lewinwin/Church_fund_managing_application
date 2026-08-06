# Branch Map — 611 Ministry Funding

> What each branch is for. **Last updated: 2026-08-06.**
> `main` is the canonical, most-complete build and the recommended deploy target.

---

## Feature matrix (the differences that matter)

| Capability | Where it lives |
|---|---|
| **S3 receipt storage** (key in DB, private bucket, presigned URLs) | `main`, `feat/s3-storage` |
| **Base64 receipt storage** (image in a DB column) | `Win-branch` |
| **OCR switchable** (`OCR_PROVIDER` = gemini / tesseract) | `main`, `Win-branch`, `Tesseract-branch` |
| **Currency ISO codes** (`ZAR 640,00`, not `R 640,00`) | `main`, `Win-branch`, `Tesseract-branch`, `feat/s3-storage` |
| **Expand all / Collapse all** on the receipts list | `main`, `Win-branch`, `feat/s3-storage` |
| **Coolify / Nixpacks deploy docs** (`nixpacks.toml`) | `main`, `Win-branch`, `feat/s3-storage` |

---

## Branches

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

---

## Which branch do I use?

- **Deploy the real app →** `main` (most complete: S3 storage, switchable OCR, deploy docs — see the README's *Deploy* section).
- **Local-only OCR, no API key →** `Tesseract-branch`, or set `OCR_PROVIDER=tesseract` on `main`.
- **UI-only demo (no database) →** `Win-UI-only`.
- **Legacy backend without object storage →** `Win-branch` (kept for reference; `main` supersedes it).

> This map is a static doc — refresh it when branches change meaningfully.
