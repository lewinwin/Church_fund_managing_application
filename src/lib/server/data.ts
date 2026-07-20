// Server-side data access. Branch isolation is enforced by an application-level
// gate (branchScope in ./scope), not Postgres RLS — no per-request set_config,
// and the scoping is a pure, unit-testable function. Shapes mirror the W1
// AppData/types so the React store barely changes. Server-only.
import { eq, sql } from "drizzle-orm";
import { db } from "#/lib/db/client";
import * as t from "#/lib/db/schema";
import { newId } from "#/lib/id";
import type {
	AppData,
	Branch,
	Category,
	CurrencyCode,
	Expense,
	FundingPlan,
	FundingPlanStatus,
	FundRelease,
	JsonValue,
	ReviewStatus,
	Role,
	User,
} from "#/lib/types";
import { runReceiptVerification } from "./ocr";
import { type AuthCtx, branchScope } from "./scope";
import {
	canBranchEdit,
	canCancel,
	canCorrect,
	canModify,
	compareReceipt,
	nextStatusAfterVerify,
	statusAfterCorrect,
} from "./verify";

const iso = (d: Date | string) => (typeof d === "string" ? d : d.toISOString());

function mapBranch(r: typeof t.branches.$inferSelect): Branch {
	return {
		id: r.id,
		name: r.name,
		country: r.country,
		localCurrency: r.localCurrency as CurrencyCode,
		exchangeRateToUsd: r.exchangeRateToUsd,
		createdAt: iso(r.createdAt),
	};
}
function mapCategory(r: typeof t.expenseCategories.$inferSelect): Category {
	return {
		id: r.id,
		name: r.name,
		parentId: r.parentId,
		active: r.active,
		createdAt: iso(r.createdAt),
	};
}
function mapExpense(r: typeof t.expenses.$inferSelect): Expense {
	return {
		id: r.id,
		branchId: r.branchId,
		submittedByUserId: r.submittedByUserId ?? "",
		description: r.description,
		expenseDate: r.expenseDate,
		localAmount: r.localAmount,
		localCurrency: r.localCurrency as CurrencyCode,
		exchangeRateToUsd: r.exchangeRateToUsd,
		usdAmount: r.usdAmount,
		categoryId: r.categoryId,
		otherSubcategoryId: r.otherSubcategoryId,
		receiptFileName: r.receiptFileName,
		receiptDataUrl: r.receiptDataUrl,
		ocrConfidence: r.ocrConfidence,
		ocrRaw: (r.ocrRaw as JsonValue | null) ?? null,
		reviewStatus: r.reviewStatus as ReviewStatus,
		reviewNote: r.reviewNote,
		modifyCount: r.modifyCount,
		createdAt: iso(r.createdAt),
	};
}
function mapPlan(r: typeof t.fundingPlans.$inferSelect): FundingPlan {
	return {
		id: r.id,
		branchId: r.branchId,
		totalTargetUsd: r.totalTargetUsd,
		description: r.description,
		status: r.status as FundingPlanStatus,
		createdAt: iso(r.createdAt),
	};
}
function mapRelease(r: typeof t.fundReleases.$inferSelect): FundRelease {
	return {
		id: r.id,
		fundingPlanId: r.fundingPlanId,
		branchId: r.branchId,
		amountUsd: r.amountUsd,
		releaseDate: r.releaseDate,
		note: r.note,
		createdByUserId: r.createdByUserId ?? "",
		createdAt: iso(r.createdAt),
	};
}
function mapUser(r: typeof t.user.$inferSelect): User {
	return {
		id: r.id,
		name: r.name,
		email: r.email,
		password: "", // never expose credentials
		role: r.role as Role,
		branchId: r.branchId,
		createdAt: iso(r.createdAt),
	};
}

// ---------------------------------------------------------------------------
// Reads — branch-scoped tables gated by branchScope(ctx, ...)
// ---------------------------------------------------------------------------

export async function getBootstrapData(ctx: AuthCtx): Promise<AppData> {
	const branches = await db.select().from(t.branches);
	const categories = await db.select().from(t.expenseCategories);
	const expenses = await db
		.select()
		.from(t.expenses)
		.where(branchScope(ctx, t.expenses.branchId));
	const fundingPlans = await db
		.select()
		.from(t.fundingPlans)
		.where(branchScope(ctx, t.fundingPlans.branchId));
	const fundReleases = await db
		.select()
		.from(t.fundReleases)
		.where(branchScope(ctx, t.fundReleases.branchId));
	const users =
		ctx.role === "hq_admin"
			? await db.select().from(t.user)
			: await db
					.select()
					.from(t.user)
					.where(eq(t.user.branchId, ctx.branchId ?? ""));

	return {
		branches: branches.map(mapBranch),
		categories: categories.map(mapCategory),
		expenses: expenses.map(mapExpense),
		fundingPlans: fundingPlans.map(mapPlan),
		fundReleases: fundReleases.map(mapRelease),
		users: users.map(mapUser),
	};
}

/** How many branches exist. Deliberately unauthenticated — the login page shows
 *  it before anyone signs in. Returns a count only, never any branch data. */
export async function getBranchCount(): Promise<number> {
	const [row] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(t.branches);
	return row?.c ?? 0;
}

// ---------------------------------------------------------------------------
// Mutations — branchId/submitter derived from ctx, never trusted from client
// ---------------------------------------------------------------------------

export interface SubmitExpenseInput {
	description: string;
	expenseDate: string;
	localAmount: number;
	localCurrency: CurrencyCode;
	exchangeRateToUsd: number;
	usdAmount: number;
	categoryId: string;
	otherSubcategoryId: string | null;
	receiptFileName: string | null;
	receiptDataUrl: string | null;
	ocrConfidence: number | null;
}

export async function submitExpense(ctx: AuthCtx, input: SubmitExpenseInput) {
	if (ctx.role !== "branch_user" || !ctx.branchId) {
		throw new Error("Only branch users can submit expenses");
	}
	const id = newId("exp");
	await db.insert(t.expenses).values({
		id,
		branchId: ctx.branchId,
		submittedByUserId: ctx.userId,
		description: input.description,
		expenseDate: input.expenseDate,
		localAmount: input.localAmount,
		localCurrency: input.localCurrency,
		exchangeRateToUsd: input.exchangeRateToUsd,
		usdAmount: input.usdAmount,
		categoryId: input.categoryId,
		otherSubcategoryId: input.otherSubcategoryId,
		receiptFileName: input.receiptFileName,
		receiptDataUrl: input.receiptDataUrl,
		ocrConfidence: input.ocrConfidence,
		ocrRaw: null,
	});
	return id;
}

function assertHq(ctx: AuthCtx) {
	if (ctx.role !== "hq_admin") throw new Error("HQ Admin only");
}

// ---------------------------------------------------------------------------
// OCR verification workflow (see OCR_VERIFY_DESIGN.md)
// ---------------------------------------------------------------------------

async function loadExpense(id: string) {
	const [row] = await db.select().from(t.expenses).where(eq(t.expenses.id, id));
	if (!row) throw new Error("Expense not found");
	return row;
}

/** Run OCR verification for a submitted expense and route it to a status.
 *  Callable by HQ or the owning branch (the post-submit trigger and Re-check).
 *  Never cancels/approves on its own — only ok / need_check / after_modify_check. */
export async function verifyExpense(ctx: AuthCtx, expenseId: string) {
	const exp = await loadExpense(expenseId);
	if (!(ctx.role === "hq_admin" || ctx.branchId === exp.branchId)) {
		throw new Error("Not allowed to verify this expense");
	}

	const cats = await db.select().from(t.expenseCategories);
	const chosenCategory =
		cats.find((c) => c.id === exp.categoryId)?.name ?? "Unknown";
	const categoryNames = cats
		.filter((c) => c.parentId === null && c.active)
		.map((c) => c.name);

	// No receipt to check against → can't confirm → route to human review.
	if (!exp.receiptDataUrl) {
		const status = nextStatusAfterVerify(exp.modifyCount, true);
		await db
			.update(t.expenses)
			.set({
				reviewStatus: status,
				ocrRaw: { error: "no receipt", checkedAt: new Date().toISOString() },
			})
			.where(eq(t.expenses.id, expenseId));
		return { status };
	}

	const ocr = await runReceiptVerification(exp.receiptDataUrl, {
		enteredAmount: exp.localAmount,
		enteredDate: exp.expenseDate,
		chosenCategory,
		categoryNames,
	});
	const cmp = compareReceipt(
		{ amount: exp.localAmount, date: exp.expenseDate },
		ocr,
	);
	const status = nextStatusAfterVerify(exp.modifyCount, cmp.needsCheck);
	await db
		.update(t.expenses)
		.set({
			reviewStatus: status,
			ocrConfidence: ocr.overallConfidence,
			ocrRaw: { ...ocr, ...cmp, checkedAt: new Date().toISOString() },
		})
		.where(eq(t.expenses.id, expenseId));
	return { status };
}

/** HQ rejects a flagged transaction. Retained (audit trail) but excluded from
 *  balances. Optional note is shown to the branch. */
export async function cancelExpense(
	ctx: AuthCtx,
	expenseId: string,
	note: string | null,
) {
	assertHq(ctx);
	const exp = await loadExpense(expenseId);
	if (!canCancel(exp.reviewStatus as ReviewStatus)) {
		throw new Error(`Cannot cancel from status "${exp.reviewStatus}"`);
	}
	await db
		.update(t.expenses)
		.set({ reviewStatus: "cancelled", reviewNote: note })
		.where(eq(t.expenses.id, expenseId));
}

/** HQ returns a flagged transaction to the branch to correct. */
export async function requestModify(
	ctx: AuthCtx,
	expenseId: string,
	note: string | null,
) {
	assertHq(ctx);
	const exp = await loadExpense(expenseId);
	if (!canModify(exp.reviewStatus as ReviewStatus)) {
		throw new Error(`Cannot modify from status "${exp.reviewStatus}"`);
	}
	await db
		.update(t.expenses)
		.set({
			reviewStatus: "modify_requested",
			reviewNote: note,
			modifyCount: (exp.modifyCount ?? 0) + 1,
		})
		.where(eq(t.expenses.id, expenseId));
}

/** HQ approves a flagged transaction. After a modify round this confirms the
 *  correction (`correct_modification`); on a first-pass flag it's HQ overriding
 *  the OCR flag and accepting the entry as-is (`ok`). HQ's call is final. */
export async function confirmModification(ctx: AuthCtx, expenseId: string) {
	assertHq(ctx);
	const exp = await loadExpense(expenseId);
	const status = exp.reviewStatus as ReviewStatus;
	if (!canCorrect(status)) {
		throw new Error(`Cannot confirm from status "${exp.reviewStatus}"`);
	}
	await db
		.update(t.expenses)
		.set({ reviewStatus: statusAfterCorrect(status) })
		.where(eq(t.expenses.id, expenseId));
}

/** The owning branch corrects a returned transaction (typed fields only). The
 *  receipt image stays fixed. Resets to `checking` so it re-verifies; the caller
 *  then triggers verifyExpense (which routes it to after_modify_check). */
export async function updateExpenseFields(
	ctx: AuthCtx,
	expenseId: string,
	input: {
		localAmount: number;
		expenseDate: string;
		categoryId: string;
		otherSubcategoryId: string | null;
		description: string;
	},
) {
	const exp = await loadExpense(expenseId);
	if (ctx.role !== "branch_user" || ctx.branchId !== exp.branchId) {
		throw new Error("Only the owning branch can edit this expense");
	}
	if (!canBranchEdit(exp.reviewStatus as ReviewStatus)) {
		throw new Error("Only a returned (modify_requested) expense can be edited");
	}
	if (!(input.localAmount > 0))
		throw new Error("Amount must be greater than 0");
	await db
		.update(t.expenses)
		.set({
			localAmount: input.localAmount,
			usdAmount: input.localAmount * exp.exchangeRateToUsd,
			expenseDate: input.expenseDate,
			categoryId: input.categoryId,
			otherSubcategoryId: input.otherSubcategoryId,
			description: input.description,
			reviewStatus: "checking",
		})
		.where(eq(t.expenses.id, expenseId));
}

export async function createFundingPlan(
	ctx: AuthCtx,
	input: {
		branchId: string;
		totalTargetUsd: number;
		description: string;
		status: FundingPlanStatus;
	},
) {
	assertHq(ctx);
	const id = newId("fp");
	await db.insert(t.fundingPlans).values({ id, ...input });
	return id;
}

export async function updateFundingPlan(
	ctx: AuthCtx,
	id: string,
	patch: Partial<{
		totalTargetUsd: number;
		description: string;
		status: FundingPlanStatus;
	}>,
) {
	assertHq(ctx);
	await db.update(t.fundingPlans).set(patch).where(eq(t.fundingPlans.id, id));
}

/** Increase a plan's target by amountUsd (atomic). HQ-only, increase-only. */
export async function addToPlanTarget(
	ctx: AuthCtx,
	planId: string,
	amountUsd: number,
) {
	assertHq(ctx);
	if (!(amountUsd > 0)) throw new Error("Amount must be greater than 0");
	await db
		.update(t.fundingPlans)
		.set({
			totalTargetUsd: sql`${t.fundingPlans.totalTargetUsd} + ${amountUsd}`,
		})
		.where(eq(t.fundingPlans.id, planId));
}

/** Create a new branch (HQ-only). The linked login account is created by the
 *  server function so Better Auth hashes the password. Returns the new id. */
export async function createBranch(
	ctx: AuthCtx,
	input: {
		name: string;
		country: string;
		currencyCode: string;
		exchangeRateToUsd: number;
	},
) {
	assertHq(ctx);
	if (!(input.exchangeRateToUsd > 0)) {
		throw new Error("Exchange rate must be greater than 0");
	}
	const id = newId("br");
	await db.insert(t.branches).values({
		id,
		name: input.name,
		country: input.country,
		localCurrency: input.currencyCode.toUpperCase(),
		exchangeRateToUsd: input.exchangeRateToUsd,
	});
	return id;
}

export async function recordFundRelease(
	ctx: AuthCtx,
	input: {
		fundingPlanId: string;
		branchId: string;
		amountUsd: number;
		releaseDate: string;
		note: string | null;
	},
) {
	assertHq(ctx);
	const id = newId("fr");
	await db
		.insert(t.fundReleases)
		.values({ id, ...input, createdByUserId: ctx.userId });
	return id;
}

export async function createCategory(
	ctx: AuthCtx,
	input: { name: string; parentId: string | null },
) {
	assertHq(ctx);
	const id = newId(input.parentId ? "sub" : "cat");
	await db.insert(t.expenseCategories).values({
		id,
		name: input.name,
		parentId: input.parentId,
		active: true,
	});
	return id;
}

export async function updateCategory(
	ctx: AuthCtx,
	id: string,
	patch: Partial<{ name: string; active: boolean }>,
) {
	assertHq(ctx);
	await db
		.update(t.expenseCategories)
		.set(patch)
		.where(eq(t.expenseCategories.id, id));
}

export async function toggleCategoryActive(ctx: AuthCtx, id: string) {
	assertHq(ctx);
	const [row] = await db
		.select({ active: t.expenseCategories.active })
		.from(t.expenseCategories)
		.where(eq(t.expenseCategories.id, id));
	if (!row) return;
	await db
		.update(t.expenseCategories)
		.set({ active: !row.active })
		.where(eq(t.expenseCategories.id, id));
}
