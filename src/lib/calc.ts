// Pure derivation of balances, statuses and aggregations from AppData.
// Every query is scoped by role + branchId to mirror the production RLS
// contract, so data isolation is provable now (context.md testing priorities).
import { usdToLocal } from "#/lib/currency/exchangeRate";
import type {
	AppData,
	BalanceStatus,
	Branch,
	BranchFinancials,
	Category,
	CurrencyCode,
	Expense,
	FundingPlan,
	FundRelease,
	User,
} from "#/lib/types";

// Balance thresholds, expressed as remaining / released.
const LOW_THRESHOLD = 0.15;
const WARNING_THRESHOLD = 0.35;

export function balanceStatus(
	remainingUsd: number,
	releasedUsd: number,
): BalanceStatus {
	if (releasedUsd <= 0) return "low";
	const ratio = remainingUsd / releasedUsd;
	if (ratio <= LOW_THRESHOLD) return "low";
	if (ratio <= WARNING_THRESHOLD) return "warning";
	return "healthy";
}

export const STATUS_LABEL: Record<BalanceStatus, string> = {
	healthy: "Healthy",
	warning: "Warning",
	low: "Low balance",
};

// ---------------------------------------------------------------------------
// Access control: the single choke point for "what can this user see".
// ---------------------------------------------------------------------------

export function canAccessBranch(user: User, branchId: string): boolean {
	if (user.role === "hq_admin") return true;
	return user.branchId === branchId;
}

/** Expenses this user is allowed to see. HQ = all; branch user = own branch. */
export function visibleExpenses(data: AppData, user: User): Expense[] {
	if (user.role === "hq_admin") return data.expenses;
	return data.expenses.filter((e) => e.branchId === user.branchId);
}

// ---------------------------------------------------------------------------
// Per-branch financials
// ---------------------------------------------------------------------------

export function releasesForBranch(
	data: AppData,
	branchId: string,
): FundRelease[] {
	return data.fundReleases.filter((r) => r.branchId === branchId);
}

export function expensesForBranch(data: AppData, branchId: string): Expense[] {
	return data.expenses.filter((e) => e.branchId === branchId);
}

export function activePlanForBranch(
	data: AppData,
	branchId: string,
): FundingPlan | undefined {
	return data.fundingPlans.find(
		(p) => p.branchId === branchId && p.status === "active",
	);
}

export function branchFinancials(
	data: AppData,
	branchId: string,
): BranchFinancials {
	const releasedUsd = round2(
		releasesForBranch(data, branchId).reduce((s, r) => s + r.amountUsd, 0),
	);
	const spentUsd = round2(
		expensesForBranch(data, branchId).reduce((s, e) => s + e.usdAmount, 0),
	);
	const remainingUsd = round2(releasedUsd - spentUsd);
	const percentUsed = releasedUsd > 0 ? spentUsd / releasedUsd : 0;
	const plan = activePlanForBranch(data, branchId);
	return {
		branchId,
		releasedUsd,
		spentUsd,
		remainingUsd,
		percentUsed,
		status: balanceStatus(remainingUsd, releasedUsd),
		targetUsd: plan?.totalTargetUsd ?? 0,
	};
}

export interface GlobalTotals {
	releasedUsd: number;
	spentUsd: number;
	remainingUsd: number;
	percentUsed: number;
	healthy: number;
	warning: number;
	low: number;
}

export function globalTotals(data: AppData): GlobalTotals {
	const perBranch = data.branches.map((b) => branchFinancials(data, b.id));
	const releasedUsd = round2(perBranch.reduce((s, f) => s + f.releasedUsd, 0));
	const spentUsd = round2(perBranch.reduce((s, f) => s + f.spentUsd, 0));
	const remainingUsd = round2(releasedUsd - spentUsd);
	return {
		releasedUsd,
		spentUsd,
		remainingUsd,
		percentUsed: releasedUsd > 0 ? spentUsd / releasedUsd : 0,
		healthy: perBranch.filter((f) => f.status === "healthy").length,
		warning: perBranch.filter((f) => f.status === "warning").length,
		low: perBranch.filter((f) => f.status === "low").length,
	};
}

export function remainingLocal(
	data: AppData,
	branchId: string,
	currency: CurrencyCode,
): number {
	const { remainingUsd } = branchFinancials(data, branchId);
	return usdToLocal(remainingUsd, currency);
}

// ---------------------------------------------------------------------------
// Category aggregation
// ---------------------------------------------------------------------------

export interface CategorySlice {
	categoryId: string;
	label: string;
	usd: number;
	count: number;
}

export function spendByCategory(
	expenses: Expense[],
	categories: Category[],
): CategorySlice[] {
	const byId = new Map<string, CategorySlice>();
	for (const e of expenses) {
		const cat = categories.find((c) => c.id === e.categoryId);
		const label = cat?.name ?? "Uncategorized";
		const existing = byId.get(e.categoryId);
		if (existing) {
			existing.usd = round2(existing.usd + e.usdAmount);
			existing.count += 1;
		} else {
			byId.set(e.categoryId, {
				categoryId: e.categoryId,
				label,
				usd: e.usdAmount,
				count: 1,
			});
		}
	}
	return [...byId.values()].sort((a, b) => b.usd - a.usd);
}

export interface BranchSlice {
	branchId: string;
	label: string;
	usd: number;
}

export function spendByBranch(data: AppData): BranchSlice[] {
	return data.branches
		.map((b) => ({
			branchId: b.id,
			label: b.name,
			usd: branchFinancials(data, b.id).spentUsd,
		}))
		.sort((a, b) => b.usd - a.usd);
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

export function primaryCategories(
	categories: Category[],
	activeOnly = false,
): Category[] {
	return categories.filter(
		(c) => c.parentId === null && (!activeOnly || c.active),
	);
}

export function subCategories(
	categories: Category[],
	parentId: string,
	activeOnly = false,
): Category[] {
	return categories.filter(
		(c) => c.parentId === parentId && (!activeOnly || c.active),
	);
}

export function categoryLabel(
	categories: Category[],
	categoryId: string,
	subId: string | null,
): string {
	const cat = categories.find((c) => c.id === categoryId);
	const base = cat?.name ?? "Uncategorized";
	if (subId) {
		const sub = categories.find((c) => c.id === subId);
		if (sub) return `${base} · ${sub.name}`;
	}
	return base;
}

export function branchById(
	branches: Branch[],
	id: string | null,
): Branch | undefined {
	if (!id) return undefined;
	return branches.find((b) => b.id === id);
}

export function userById(users: User[], id: string): User | undefined {
	return users.find((u) => u.id === id);
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
