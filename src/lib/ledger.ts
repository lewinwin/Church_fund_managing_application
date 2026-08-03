// The branch ledger: the single home for a Branch's money. Everything that turns
// Expenses and Fund releases into released / spent / remaining lives here, so the
// one correctness-critical rule — cancelled Expenses never count — is applied in
// exactly one place instead of being remembered at each call site.
//
// Every amount is in the branch's own local currency; there is no cross-branch
// total (branches use different currencies that can't be summed). The module
// never hands a raw Expense[] back to be summed: callers get already reconciled
// figures and category slices.
import {
	activePlanForBranch,
	balanceStatus,
	branchById,
	type CategorySlice,
	fundableExpenses,
	releasesForBranch,
	spendByCategory,
} from "#/lib/calc";
import type {
	AppData,
	BalanceStatus,
	CurrencyCode,
	Expense,
} from "#/lib/types";

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

/** Sum the fundable (non-cancelled) local amounts across an arbitrary Expense
 *  subset — the only sanctioned way to total spend, e.g. the date-filtered
 *  Reports view. All expenses in the subset must share one currency. */
export function spentOf(expenses: Expense[]): number {
	return round2(
		expenses
			.filter((e) => e.reviewStatus !== "cancelled")
			.reduce((s, e) => s + e.localAmount, 0),
	);
}

export interface BranchLedger {
	branchId: string;
	currency: CurrencyCode;
	released: number;
	spent: number;
	remaining: number;
	target: number;
	percentUsed: number;
	status: BalanceStatus;
	/** Spend broken down by category — fundable Expenses only. */
	byCategory: CategorySlice[];
}

/** Everything money about one Branch, reconciled in its local currency. */
export function ledgerFor(data: AppData, branchId: string): BranchLedger {
	const branch = branchById(data.branches, branchId);
	const currency = branch?.localCurrency ?? "";

	const released = round2(
		releasesForBranch(data, branchId).reduce((s, r) => s + r.amount, 0),
	);
	const fundable = fundableExpenses(data, branchId);
	const spent = spentOf(fundable);
	const remaining = round2(released - spent);
	const target = activePlanForBranch(data, branchId)?.totalTarget ?? 0;

	return {
		branchId,
		currency,
		released,
		spent,
		remaining,
		target,
		percentUsed: released > 0 ? spent / released : 0,
		status: balanceStatus(remaining, released),
		byCategory: spendByCategory(fundable, data.categories),
	};
}
