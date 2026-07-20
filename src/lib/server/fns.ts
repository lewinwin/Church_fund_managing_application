// Server functions — the app's RPC API. Client code imports these and calls
// them like normal async functions; TanStack Start runs the handlers on the
// server. Each data handler resolves the session and enforces RLS.
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { getAuthCtx, requireAuthCtx } from "#/lib/auth/ctx";
import { auth } from "#/lib/auth/server";
import { db } from "#/lib/db/client";
import { user as userTable } from "#/lib/db/schema";
import type { FundingPlanStatus, Role } from "#/lib/types";
import * as data from "./data";
import { runReceiptOcr } from "./ocr";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const getSessionFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await auth.api.getSession({
			headers: getRequest().headers,
		});
		if (!session?.user) return null;
		const u = session.user as {
			id: string;
			name: string;
			email: string;
			role?: string;
			branchId?: string | null;
		};
		return {
			id: u.id,
			name: u.name,
			email: u.email,
			role: (u.role ?? "branch_user") as "hq_admin" | "branch_user",
			branchId: u.branchId ?? null,
		};
	},
);

export const signInFn = createServerFn({ method: "POST" })
	.validator((d: { email: string; password: string }) => d)
	.handler(async ({ data: body }) => {
		try {
			const { headers } = await auth.api.signInEmail({
				body,
				headers: getRequest().headers,
				returnHeaders: true,
			});
			const cookie = headers.get("set-cookie");
			if (cookie) setResponseHeader("set-cookie", cookie);
			return { ok: true as const };
		} catch {
			return { ok: false as const, error: "Invalid email or password." };
		}
	});

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
	try {
		const { headers } = await auth.api.signOut({
			headers: getRequest().headers,
			returnHeaders: true,
		});
		const cookie = headers.get("set-cookie");
		if (cookie) setResponseHeader("set-cookie", cookie);
	} catch {
		// already signed out — ignore
	}
	return { ok: true as const };
});

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const bootstrapFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const ctx = await getAuthCtx();
		if (!ctx) return null;
		return data.getBootstrapData(ctx);
	},
);

// Receipt OCR (Gemini 2.5 Flash). Runs server-side so the API key stays secret.
// Any signed-in user may extract; the result only pre-fills their review form.
export const ocrExtractFn = createServerFn({ method: "POST" })
	.validator((d: { dataUrl: string }) => d)
	.handler(async ({ data: input }) => {
		await requireAuthCtx();
		return runReceiptOcr(input.dataUrl);
	});

export const submitExpenseFn = createServerFn({ method: "POST" })
	.validator((d: data.SubmitExpenseInput) => d)
	.handler(async ({ data: input }) =>
		data.submitExpense(await requireAuthCtx(), input),
	);

// ---------------------------------------------------------------------------
// OCR verification workflow (see OCR_VERIFY_DESIGN.md). Verify is callable by HQ
// or the owning branch (post-submit trigger + Re-check). Cancel/Modify/Correct
// are HQ-only (guarded inside the data layer); edit is owning-branch-only.
// ---------------------------------------------------------------------------

export const verifyExpenseFn = createServerFn({ method: "POST" })
	.validator((d: { expenseId: string }) => d)
	.handler(async ({ data: input }) =>
		data.verifyExpense(await requireAuthCtx(), input.expenseId),
	);

export const cancelExpenseFn = createServerFn({ method: "POST" })
	.validator((d: { expenseId: string; note: string | null }) => d)
	.handler(async ({ data: input }) => {
		await data.cancelExpense(
			await requireAuthCtx(),
			input.expenseId,
			input.note,
		);
		return { ok: true as const };
	});

export const requestModifyFn = createServerFn({ method: "POST" })
	.validator((d: { expenseId: string; note: string | null }) => d)
	.handler(async ({ data: input }) => {
		await data.requestModify(
			await requireAuthCtx(),
			input.expenseId,
			input.note,
		);
		return { ok: true as const };
	});

export const confirmModificationFn = createServerFn({ method: "POST" })
	.validator((d: { expenseId: string }) => d)
	.handler(async ({ data: input }) => {
		await data.confirmModification(await requireAuthCtx(), input.expenseId);
		return { ok: true as const };
	});

export const updateExpenseFieldsFn = createServerFn({ method: "POST" })
	.validator(
		(d: {
			expenseId: string;
			localAmount: number;
			expenseDate: string;
			categoryId: string;
			otherSubcategoryId: string | null;
			description: string;
		}) => d,
	)
	.handler(async ({ data: input }) => {
		const { expenseId, ...fields } = input;
		await data.updateExpenseFields(await requireAuthCtx(), expenseId, fields);
		return { ok: true as const };
	});

export const createFundingPlanFn = createServerFn({ method: "POST" })
	.validator(
		(d: {
			branchId: string;
			totalTargetUsd: number;
			description: string;
			status: FundingPlanStatus;
		}) => d,
	)
	.handler(async ({ data: input }) =>
		data.createFundingPlan(await requireAuthCtx(), input),
	);

export const updateFundingPlanFn = createServerFn({ method: "POST" })
	.validator(
		(d: {
			id: string;
			patch: Partial<{
				totalTargetUsd: number;
				description: string;
				status: FundingPlanStatus;
			}>;
		}) => d,
	)
	.handler(async ({ data: input }) =>
		data.updateFundingPlan(await requireAuthCtx(), input.id, input.patch),
	);

export const recordFundReleaseFn = createServerFn({ method: "POST" })
	.validator(
		(d: {
			fundingPlanId: string;
			branchId: string;
			amountUsd: number;
			releaseDate: string;
			note: string | null;
		}) => d,
	)
	.handler(async ({ data: input }) =>
		data.recordFundRelease(await requireAuthCtx(), input),
	);

export const createCategoryFn = createServerFn({ method: "POST" })
	.validator((d: { name: string; parentId: string | null }) => d)
	.handler(async ({ data: input }) =>
		data.createCategory(await requireAuthCtx(), input),
	);

export const updateCategoryFn = createServerFn({ method: "POST" })
	.validator(
		(d: { id: string; patch: Partial<{ name: string; active: boolean }> }) => d,
	)
	.handler(async ({ data: input }) =>
		data.updateCategory(await requireAuthCtx(), input.id, input.patch),
	);

export const toggleCategoryActiveFn = createServerFn({ method: "POST" })
	.validator((d: { id: string }) => d)
	.handler(async ({ data: input }) =>
		data.toggleCategoryActive(await requireAuthCtx(), input.id),
	);

export const createUserFn = createServerFn({ method: "POST" })
	.validator(
		(d: { name: string; email: string; role: Role; branchId: string | null }) =>
			d,
	)
	.handler(async ({ data: input }) => {
		const ctx = await requireAuthCtx();
		if (ctx.role !== "hq_admin") throw new Error("HQ Admin only");
		await auth.api.signUpEmail({
			body: { email: input.email, password: "demo123", name: input.name },
		});
		await db
			.update(userTable)
			.set({
				role: input.role,
				branchId: input.role === "hq_admin" ? null : input.branchId,
			})
			.where(eq(userTable.email, input.email));
		return { ok: true as const };
	});

export const updateUserFn = createServerFn({ method: "POST" })
	.validator(
		(d: {
			id: string;
			patch: { name?: string; role?: Role; branchId?: string | null };
		}) => d,
	)
	.handler(async ({ data: input }) => {
		const ctx = await requireAuthCtx();
		if (ctx.role !== "hq_admin") throw new Error("HQ Admin only");
		await db.update(userTable).set(input.patch).where(eq(userTable.id, input.id));
		return { ok: true as const };
	});

// Create a branch + its login account (HQ-only). The branch row is created
// first, then Better Auth's signUpEmail hashes the password, then the new user
// is linked to the branch as a branch_user.
export const createBranchFn = createServerFn({ method: "POST" })
	.validator(
		(d: {
			name: string;
			country: string;
			currencyCode: string;
			exchangeRateToUsd: number;
			loginEmail: string;
			defaultPassword: string;
		}) => d,
	)
	.handler(async ({ data: input }) => {
		const ctx = await requireAuthCtx();
		const branchId = await data.createBranch(ctx, {
			name: input.name,
			country: input.country,
			currencyCode: input.currencyCode,
			exchangeRateToUsd: input.exchangeRateToUsd,
		});
		await auth.api.signUpEmail({
			body: {
				email: input.loginEmail,
				password: input.defaultPassword,
				name: input.name,
			},
		});
		await db
			.update(userTable)
			.set({ role: "branch_user", branchId })
			.where(eq(userTable.email, input.loginEmail));
		return { ok: true as const, branchId };
	});

// Increase an existing plan's target (HQ-only). Client sends the USD amount.
export const addToPlanTargetFn = createServerFn({ method: "POST" })
	.validator((d: { planId: string; amountUsd: number }) => d)
	.handler(async ({ data: input }) =>
		data.addToPlanTarget(await requireAuthCtx(), input.planId, input.amountUsd),
	);

// A branch user changes their own password (Better Auth, session-scoped).
export const changePasswordFn = createServerFn({ method: "POST" })
	.validator((d: { currentPassword: string; newPassword: string }) => d)
	.handler(async ({ data: input }) => {
		try {
			await auth.api.changePassword({
				body: {
					currentPassword: input.currentPassword,
					newPassword: input.newPassword,
				},
				headers: getRequest().headers,
			});
			return { ok: true as const };
		} catch {
			return {
				ok: false as const,
				error: "Could not change password. Check your current password.",
			};
		}
	});
