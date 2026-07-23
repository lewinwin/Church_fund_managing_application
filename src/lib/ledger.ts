// The branch ledger: the single home for a Branch's money. Everything that turns
// Expenses and Fund releases into released / spent / remaining lives here, so the
// one correctness-critical rule — cancelled Expenses never count — is applied in
// exactly one place instead of being remembered at each call site.
//
// The module never hands a raw Expense[] back to be summed: callers get already
// reconciled figures (USD *and* the branch's local currency) and category slices.
// "Sum the wrong set" is therefore unrepresentable at a page.
import {
	activePlanForBranch,
	balanceStatus,
	type CategorySlice,
	fundableExpenses,
	releasesForBranch,
	spendByCategory,
	branchById,
} from "#/lib/calc";
import { usdToLocal } from "#/lib/currency/exchangeRate";
import type {
	AppData,
	BalanceStatus,
	CurrencyCode,
	Expense,
} from "#/lib/types";

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

/** Sum the fundable (non-cancelled) USD across an arbitrary Expense subset — the
 *  only sanctioned way to total spend, e.g. the date-filtered Reports view. */
export function spentUsdOf(expenses: Expense[]): number {
	return round2(
		expenses
			.filter((e) => e.reviewStatus !== "cancelled")
			.reduce((s, e) => s + e.usdAmount, 0),
	);
}

export interface BranchLedger {
	branchId: string;
	currency: CurrencyCode;
	rate: number;
	releasedUsd: number;
	spentUsd: number;
	remainingUsd: number;
	releasedLocal: number;
	spentLocal: number;
	remainingLocal: number;
	targetUsd: number;
	targetLocal: number;
	percentUsed: number;
	status: BalanceStatus;
	/** Spend broken down by category — fundable Expenses only. */
	byCategory: CategorySlice[];
}

/** Everything money about one Branch, reconciled and currency-converted once. */
export function ledgerFor(data: AppData, branchId: string): BranchLedger {
	const branch = branchById(data.branches, branchId);
	const rate = branch?.exchangeRateToUsd ?? 1;
	const currency = branch?.localCurrency ?? "USD";

	const releasedUsd = round2(
		releasesForBranch(data, branchId).reduce((s, r) => s + r.amountUsd, 0),
	);
	const fundable = fundableExpenses(data, branchId);
	const spentUsd = spentUsdOf(fundable);
	const remainingUsd = round2(releasedUsd - spentUsd);
	const targetUsd = activePlanForBranch(data, branchId)?.totalTargetUsd ?? 0;

	return {
		branchId,
		currency,
		rate,
		releasedUsd,
		spentUsd,
		remainingUsd,
		releasedLocal: usdToLocal(releasedUsd, rate),
		spentLocal: usdToLocal(spentUsd, rate),
		remainingLocal: usdToLocal(remainingUsd, rate),
		targetUsd,
		targetLocal: usdToLocal(targetUsd, rate),
		percentUsed: releasedUsd > 0 ? spentUsd / releasedUsd : 0,
		status: balanceStatus(remainingUsd, releasedUsd),
		byCategory: spendByCategory(fundable, data.categories),
	};
}

export interface GlobalLedger {
	releasedUsd: number;
	spentUsd: number;
	remainingUsd: number;
	percentUsed: number;
	healthy: number;
	warning: number;
	low: number;
}

/** HQ-wide totals in USD (the only common unit across branches). */
export function globalLedger(data: AppData): GlobalLedger {
	const perBranch = data.branches.map((b) => ledgerFor(data, b.id));
	const releasedUsd = round2(perBranch.reduce((s, l) => s + l.releasedUsd, 0));
	const spentUsd = round2(perBranch.reduce((s, l) => s + l.spentUsd, 0));
	return {
		releasedUsd,
		spentUsd,
		remainingUsd: round2(releasedUsd - spentUsd),
		percentUsed: releasedUsd > 0 ? spentUsd / releasedUsd : 0,
		healthy: perBranch.filter((l) => l.status === "healthy").length,
		warning: perBranch.filter((l) => l.status === "warning").length,
		low: perBranch.filter((l) => l.status === "low").length,
	};
}
