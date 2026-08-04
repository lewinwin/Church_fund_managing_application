// Domain types for the 611 Ministry Funding prototype.
// Mirrors the schema in context.md so the W2 DB migration reshapes nothing.

import type { OcrCheck } from "#/lib/ocrCheck";

export type Role = "hq_admin" | "branch_user";

// A 3-letter ISO currency code. Kept as a broad string (not a fixed union) so
// HQ can add branches with new currencies at runtime; each branch stores its own
// exchange rate. KNOWN_CURRENCIES are the built-ins with seed rates.
export type CurrencyCode = string;

export const KNOWN_CURRENCIES = ["USD", "SGD", "ZAR", "MWK", "CRC"] as const;

export type FundingPlanStatus = "active" | "closed" | "cancelled";

export type BalanceStatus = "healthy" | "warning" | "low";

// OCR verification lifecycle for a submitted expense. See OCR_VERIFY_DESIGN.md.
//  checking            – submitted; OCR verification pending/running
//  ok                  – OCR matched (amount+date+category, confident); shows normally
//  need_check          – OCR flagged a mismatch/low confidence; awaits HQ review
//  cancelled           – HQ rejected; retained but excluded from balances
//  modify_requested    – HQ returned it to the branch to correct
//  after_modify_check  – branch resubmitted; re-checked; awaits HQ 2nd review
//  correct_modification– HQ confirmed the correction; final good state
export type ReviewStatus =
	| "checking"
	| "ok"
	| "need_check"
	| "cancelled"
	| "modify_requested"
	| "after_modify_check"
	| "correct_modification";

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
	/** The branch operates entirely in this currency. All its amounts are stored
	 *  and shown in it — there is no cross-branch/common currency. */
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
	/** The amount, in the branch's local currency. */
	localAmount: number;
	localCurrency: CurrencyCode;
	categoryId: string;
	otherSubcategoryId: string | null;
	receiptFileName: string | null;
	/** Object-storage key for the receipt file (bytes live in S3/R2, not the DB).
	 *  View it via a presigned URL; null when no receipt was stored. */
	receiptKey: string | null;
	ocrConfidence: number | null;
	/** The typed OCR verification record (entered-vs-receipt comparison), or null
	 *  before it has been checked. Persisted in the ocr_raw jsonb column. */
	ocrCheck: OcrCheck | null;
	/** OCR verification lifecycle status. Only `cancelled` is excluded from balances. */
	reviewStatus: ReviewStatus;
	/** HQ's optional note on Cancel/Modify, shown to the branch. */
	reviewNote: string | null;
	/** Number of times HQ has sent this back for modification. */
	modifyCount: number;
	createdAt: string;
}

export interface FundingPlan {
	id: string;
	branchId: string;
	/** Target in the branch's local currency. */
	totalTarget: number;
	description: string;
	status: FundingPlanStatus;
	createdAt: string;
}

export interface FundRelease {
	id: string;
	fundingPlanId: string;
	branchId: string;
	/** Amount released, in the branch's local currency. */
	amount: number;
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
