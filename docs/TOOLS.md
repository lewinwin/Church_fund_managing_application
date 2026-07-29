# Tools & Libraries

A plain-language reference to everything this project is built with — **what each tool does** and **why we use it**. Written so anyone can explain the stack without reading the code.

> Quick mental model: the app is a website (TanStack Start + React) that talks to a database (PostgreSQL via Drizzle), signs people in (Better Auth), and reads receipts locally (Tesseract + PDF tools). Everything runs with no paid API keys.

---

## 1. Receipt reading (OCR) — the local pipeline

This is the part we most recently built. The goal: read the **amount and date** off an uploaded receipt **on our own server**, with **no external API, no key, and no internet** (works offline / in regions that block cloud AI). Three tools cooperate, and they feed one shared text parser.

| Tool | What it does | Why we use it |
|---|---|---|
| **Tesseract.js** | OCR engine — turns an **image** of text into actual text characters. | Free, runs fully locally (no API key), the standard open-source OCR. Reads photo receipts and rendered PDF pages. |
| **unpdf** | Reads **PDFs** in two ways: pulls the **text layer** out of a digital PDF, and can **render a PDF page to an image**. Pure JavaScript (a serverless build of Mozilla's pdf.js). | Lets us handle both kinds of PDF with no native/system dependencies for the text path; designed to run on servers/serverless. |
| **@napi-rs/canvas** | A **drawing surface** (canvas) that unpdf needs to actually paint a PDF page into an image. | Prebuilt native module — installs with no compiler. Required to turn scanned PDFs into images for OCR. |

**How they fit together** — one uploaded receipt takes one of three routes, and all three end at the same parser:

```
Uploaded receipt
   ├─ image (JPG/PNG)            → Tesseract OCR ──────────────┐
   ├─ digital PDF (has text)     → unpdf: read text layer ─────┤→ receiptParse → amount + date
   └─ scanned PDF (no text)      → unpdf+canvas: render pages   │
                                   → Tesseract OCR each ────────┘
```

- **`receiptParse.ts`** (our own code, not a library) is the shared "understanding" step: it takes the raw text and finds the **total** (preferring a line labelled *Total*, skipping *sub-total*) and the **date**. It's pure and unit-tested.
- **Accuracy note to explain:** the *digital PDF* path is exact (it reads real text). The *image* and *scanned-PDF* paths use OCR, which can misread a character (e.g. `498.72` → `98.72`). That's fine by design: a misread won't match what the branch typed, so it's **flagged for HQ review** rather than silently accepted.
- **Category is not read** by any of these — there's no AI that understands meaning, so HQ decides the category manually.

**Try each path offline:** `bun run ocr:smoke` (image), `bun run pdf:smoke` (digital PDF), `bun run pdf:render` (render a scanned PDF to images).

---

## 2. Core framework — the website itself

| Tool | What it does | Why we use it |
|---|---|---|
| **TanStack Start** | The full-stack React framework: it serves the pages **and** runs our server code (the "server functions"). | One tool for both front-end and back-end; no separate API server to build or deploy. |
| **React 19** | Builds the user interface out of reusable components. | Industry standard for interactive UIs. |
| **TanStack Router** | Decides which page shows for which URL. It's **file-based** — each file in `src/routes/` is a page. | Type-safe routing that fits TanStack Start. |
| **Vite** + **Nitro** | Vite is the dev server/bundler (fast reloads); Nitro is the server engine underneath that runs our back-end. | Fast local development; Nitro makes the app deployable to many hosts. |

---

## 3. Data & sign-in

| Tool | What it does | Why we use it |
|---|---|---|
| **PostgreSQL** | The database — stores branches, expenses, funding plans, users, etc. | Reliable, standard relational database. |
| **Drizzle ORM** | Lets us read/write the database using **typed TypeScript** instead of raw SQL, and defines the table shapes (`db/schema.ts`). | Type-safe queries; the schema is code, so mistakes are caught before running. |
| **postgres.js** | The low-level driver Drizzle uses to actually talk to PostgreSQL. | Fast, modern Postgres client. |
| **Better Auth** | Handles **login**: email/password, securely hashed, plus session cookies. We added `role` and `branchId` to each user. | Batteries-included auth so we don't hand-roll password security. |

> Security note worth saying: a branch user can only ever see **their own branch's** data. That's enforced in our own code (`scope.ts`), which every data read passes through.

---

## 4. Look & feel

| Tool | What it does | Why we use it |
|---|---|---|
| **Tailwind CSS** | Styling via small utility classes right in the markup. | Fast, consistent styling without separate CSS files. |
| **lucide-react** | The icon set (the little symbols on buttons). | Clean, open-source icons that fit React. |

---

## 5. Quality & build tooling

| Tool | What it does | Why we use it |
|---|---|---|
| **Bun** | Runs the project, installs packages, and executes our scripts (`bun run …`). | Very fast all-in-one JavaScript runtime + package manager. |
| **TypeScript** | JavaScript **with types** — catches whole classes of bugs before the app runs (`tsc` must stay clean). | Safety and better tooling across the whole codebase. |
| **Vitest** | The test runner — runs our automated tests (e.g. the receipt parser's cases). | Fast, integrates with Vite; tests double as documentation. |
| **Biome** | Formatter + linter — keeps code style consistent and flags mistakes. | One fast tool instead of separate ESLint/Prettier. |

---

## 6. Infrastructure & dev helpers

| Tool | What it does | Why we use it |
|---|---|---|
| **Docker** | Runs PostgreSQL (and Redis) locally with one command (`docker compose up -d`). | Everyone gets the same database setup with no manual install. |
| **Vercel** | Hosts the deployed app. | Simple deploys straight from GitHub. |
| **ngrok** | Dev-only: exposes the local app on a temporary public URL, e.g. to demo on a phone. | Quick sharing/testing without deploying. |
| **Git + GitHub** | Version control and where issues / pull requests live. | Track every change and review work. |

*(The separate `backend-supabase-included` build additionally uses **Supabase** for hosted Postgres + receipt-image storage. This pure build keeps images in the database and needs no Supabase.)*

---

## One-line summary per layer

- **See it:** React + TanStack Router + Tailwind + lucide icons.
- **Run it:** TanStack Start + Vite + Nitro, on Bun, typed with TypeScript.
- **Store it:** PostgreSQL via Drizzle; sign-in via Better Auth.
- **Read receipts:** Tesseract (images) + unpdf (PDF text) + @napi-rs/canvas (render scanned PDFs) → our own parser.
- **Ship it:** Docker locally, Vercel in production, GitHub for the workflow.
