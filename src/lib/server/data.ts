// Server-side data access. Branch isolation is enforced by an application-level
// gate (branchScope in ./scope), not Postgres RLS — no per-request set_config,
// and the scoping is a pure, unit-testable function. Shapes mirror the W1
// AppData/types so the React store barely changes. Server-only.
import { eq } from "drizzle-orm";
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
	Role,
	User,
} from "#/lib/types";
import { type AuthCtx, branchScope } from "./scope";

const iso = (d: Date | string) => (typeof d === "string" ? d : d.toISOString());

function mapBranch(r: typeof t.branches.$inferSelect): Branch {
	return {
		id: r.id,
		name: r.name,
		country: r.country,
		localCurrency: r.localCurrency as CurrencyCode,
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
