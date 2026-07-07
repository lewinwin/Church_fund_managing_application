// Server-side data access. Every read/write goes through withRls so Postgres
// enforces branch isolation. Shapes mirror the W1 AppData/types so the React
// store barely changes. Server-only.
import { eq } from "drizzle-orm";
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
import { type AuthCtx, withRls } from "./rls";

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
// Reads
// ---------------------------------------------------------------------------

export async function getBootstrapData(ctx: AuthCtx): Promise<AppData> {
	return withRls(ctx, async (tx) => {
		const branches = await tx.select().from(t.branches);
		const categories = await tx.select().from(t.expenseCategories);
		const expenses = await tx.select().from(t.expenses); // RLS-scoped
		const fundingPlans = await tx.select().from(t.fundingPlans); // RLS-scoped
		const fundReleases = await tx.select().from(t.fundReleases); // RLS-scoped
		const users =
			ctx.role === "hq_admin"
				? await tx.select().from(t.user)
				: await tx
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
	});
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
	await withRls(ctx, (tx) =>
		tx.insert(t.expenses).values({
			id,
			branchId: ctx.branchId as string,
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
		}),
	);
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
	await withRls(ctx, (tx) => tx.insert(t.fundingPlans).values({ id, ...input }));
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
	await withRls(ctx, (tx) =>
		tx.update(t.fundingPlans).set(patch).where(eq(t.fundingPlans.id, id)),
	);
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
	await withRls(ctx, (tx) =>
		tx.insert(t.fundReleases).values({ id, ...input, createdByUserId: ctx.userId }),
	);
	return id;
}

export async function createCategory(
	ctx: AuthCtx,
	input: { name: string; parentId: string | null },
) {
	assertHq(ctx);
	const id = newId(input.parentId ? "sub" : "cat");
	await withRls(ctx, (tx) =>
		tx.insert(t.expenseCategories).values({
			id,
			name: input.name,
			parentId: input.parentId,
			active: true,
		}),
	);
	return id;
}

export async function updateCategory(
	ctx: AuthCtx,
	id: string,
	patch: Partial<{ name: string; active: boolean }>,
) {
	assertHq(ctx);
	await withRls(ctx, (tx) =>
		tx.update(t.expenseCategories).set(patch).where(eq(t.expenseCategories.id, id)),
	);
}

export async function toggleCategoryActive(ctx: AuthCtx, id: string) {
	assertHq(ctx);
	await withRls(ctx, async (tx) => {
		const [row] = await tx
			.select({ active: t.expenseCategories.active })
			.from(t.expenseCategories)
			.where(eq(t.expenseCategories.id, id));
		if (!row) return;
		await tx
			.update(t.expenseCategories)
			.set({ active: !row.active })
			.where(eq(t.expenseCategories.id, id));
	});
}
