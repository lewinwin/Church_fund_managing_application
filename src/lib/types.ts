// Domain types for the 611 Petty Cash prototype.
// Mirrors the schema in context.md so the W2 DB migration reshapes nothing.

export type Role = "hq_admin" | "branch_user";

export type CurrencyCode = "ZAR" | "MWK" | "SGD" | "CRC" | "USD";

export type FundingPlanStatus = "active" | "closed" | "cancelled";

export type BalanceStatus = "healthy" | "warning" | "low";

/** JSON-serializable value (safe to send across the server-function boundary). */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export interface Branch {
	id: string;
	name: string;
	country: string;
	localCurrency: CurrencyCode;
	createdAt: string;
}

export interface User {
	id: string;
	name: string;
	email: string;
	/** Mock-only. Real auth (Better Auth) lands in W2. */
	password: string;
	role: Role;
	branchId: string | null;
	createdAt: string;
}

export interface Category {
	id: string;
	name: string;
	/** null = primary category. Only children of "Other" are allowed in v1. */
	parentId: string | null;
	active: boolean;
	createdAt: string;
}

export interface Expense {
	id: string;
	branchId: string;
	submittedByUserId: string;
	/** Free-text detail of what the expense was for (replaces merchant name). */
	description: string;
	/** ISO date (YYYY-MM-DD) of the receipt. */
	expenseDate: string;
	localAmount: number;
	localCurrency: CurrencyCode;
	/** Snapshotted at entry time. Never recalculated. */
	exchangeRateToUsd: number;
	usdAmount: number;
	categoryId: string;
	otherSubcategoryId: string | null;
	receiptFileName: string | null;
	/** base64 data URL held client-side for preview (no real storage in W1). */
	receiptDataUrl: string | null;
	ocrConfidence: number | null;
	ocrRaw: JsonValue | null;
	createdAt: string;
}

export interface FundingPlan {
	id: string;
	branchId: string;
	totalTargetUsd: number;
	description: string;
	status: FundingPlanStatus;
	createdAt: string;
}

export interface FundRelease {
	id: string;
	fundingPlanId: string;
	branchId: string;
	amountUsd: number;
	releaseDate: string;
	note: string | null;
	createdByUserId: string;
	createdAt: string;
}

export interface AppData {
	branches: Branch[];
	users: User[];
	categories: Category[];
	expenses: Expense[];
	fundingPlans: FundingPlan[];
	fundReleases: FundRelease[];
}

export interface Session {
	userId: string;
}

/** Derived per-branch financials (never persisted — computed on read). */
export interface BranchFinancials {
	branchId: string;
	releasedUsd: number;
	spentUsd: number;
	remainingUsd: number;
	percentUsed: number;
	status: BalanceStatus;
	targetUsd: number;
}
