# Mockups — 611 Petty Cash (Week 1 Prototype)

> These wireframes describe the screens implemented in the W1 prototype. The
> live prototype is the source of truth; run `bun run dev` and log in with the
> demo accounts to click through them.

**Visual language:** light canvas (`#f4f7f4`), white rounded cards, forest-green ink (`#163d2f`), lime accent (`#a3e061`), soft shadows. Left sidebar (role-based) + sticky top bar (title, branch/HQ scope, search, notifications, avatar menu).

---

## 1. Login  ·  `/login`

Split screen. Left = forest-green brand panel (logo, tagline, stats). Right = form.

```
┌───────────────────────────┬──────────────────────────────┐
│  ● 611 Petty Cash         │   Welcome back                │
│                           │   Log in to your account      │
│  Every branch. Every      │                               │
│  receipt. One clear       │   Email  [________________]   │
│  view in USD.             │   Pass   [__________] 👁       │
│                           │   ☐ Remember   Forgot password?│
│  4 Branches  USD  OCR     │   [        Log in           ]  │
│                           │   Demo: HQ | SG | MW | ZA | CR │
└───────────────────────────┴──────────────────────────────┘
```
Demo-account chips quick-fill credentials. Forgot/Reset password are UI-only screens.

---

## 2. Branch Dashboard  ·  `/dashboard` (Branch User)

```
[ Released ][ Spent ][ Remaining USD ][ Remaining local ]   ← 4 stat cards
┌──────────────────────────────┐  ┌───────────────────────┐
│ Fund balance                 │  │ Quick actions         │
│ Released  Spent  Remaining   │  │ [Upload a receipt]    │
│ ███████████░░░░  66% used  🟡│  │ [Export branch report]│
├──────────────────────────────┤  ├───────────────────────┤
│ Recent transactions   [all]  │  │ Expense by category   │
│ • Merchant   cat   $usd/loc  │  │      ◕ donut + legend  │
└──────────────────────────────┘  └───────────────────────┘
```
Status card = Healthy / Warning / Low. Clicking a transaction opens the receipt detail drawer.

---

## 3. Upload Receipt  ·  `/submit-receipt` (Branch User)

Two columns: **1 · Upload + OCR state** | **2 · Review & confirm**.

```
┌ 1 · Upload receipt ─────────┐   ┌ 2 · Review & confirm ───────┐
│  ⬆ drag/click to upload     │   │ Merchant  [____________]    │
│  ☐ Simulate OCR failure     │   │ Amount [____]  Currency[SGD]│
├ OCR status ─────────────────┤   │ Date   [__________]         │
│  ⟳ Reading… → ✓ pre-filled  │   │ Category [Other ▾]          │
│  (or) Low confidence →      │   │ Sub-category [required ▾]   │
│  manual entry               │   │ ── USD equivalent  $NN.NN ──│
│  [receipt preview]          │   │ [     Submit expense     ]  │
└─────────────────────────────┘   └─────────────────────────────┘
```
Sub-category dropdown appears only when primary = **Other** (and is required). USD equivalent updates live. Success screen confirms and offers "Submit another".

---

## 4. My Receipts  ·  `/expenses` (Branch User)

Search + category filter, then a table: Date · Merchant · Category · Local amount · Currency · USD. Row click → detail drawer with receipt preview, full fields, snapshotted rate, submitter, and OCR confidence. Only the branch's own expenses ever load.

---

## 5. HQ Dashboard  ·  `/dashboard` (HQ Admin)

```
[ Total released ][ Total spent ][ Total remaining ][ Branches at risk ]
┌ Consolidated fund usage (USD) ██████░░ ┐  ┌ Quick action ───────┐
│ Released  Spent  Remaining              │  │ [Record fund release]│
└─────────────────────────────────────────┘  │ [Manage plans]      │
┌ Branch funding status ──────────────────────────────────────────┐
│ Branch │Country│Cur│Released│Spent│Remaining│%used│ Status  │→   │
│ (click a row → Branch Detail)                                    │
└──────────────────────────────────────────────────────────────────┘
[ Spending by branch — bars ]   [ Expense by category — donut ]
[ Recent expenses across all branches (with branch label) ]
```

---

## 6. Branch Detail  ·  `/branches/$branchId` (HQ Admin)

Header (branch, country, currency) + **Record fund release** button. Stat cards (Released / Spent / Remaining USD / Remaining local). Fund balance panel with status. Category donut. **Fund release history** table (date, amount, note, recorded by). Expenses table with search/filter + detail drawer.

---

## 7. Funding Plans  ·  `/funding-plans` (HQ Admin)

Table: Branch · Target · Released · Spent · Available · Left to release · % used · Status · [Manage]. Actions: **New plan** (branch, target USD, description, status — only branches without an active plan) and **Record release** (branch, amount USD, date, note). Available = released − spent.

---

## 8. Categories  ·  `/categories` (HQ Admin)

Two lists: **Primary categories** and **"Other" sub-categories**. Each row: name, Active/Inactive badge, Rename, Activate/Deactivate. **Add category** modal chooses Primary or Sub-category-of-Other. Branch users only ever see active categories.

---

## 9. Users  ·  `/users` (HQ Admin)

Table: user (avatar + email) · Role badge · Branch · [Edit]. **Add user** (name, email, role, branch if Branch User). Edit updates name/role/branch.

---

## 10. Reports / Export  ·  `/reports` (both roles)

Filters: date range, category, (HQ: branch + currency view). Summary cards (Released / Spent-filtered / Remaining / Receipts). Report table. **CSV** download + **PDF** print. Branch users are locked to their own branch.

---

## 11. Settings  ·  `/settings` (both roles)

Account card (avatar, email, role, log out). Branch info card (branch, country, currency, rate) for branch users / HQ scope card for admins. **Reset demo data** action restores the seed dataset (with confirm modal).
