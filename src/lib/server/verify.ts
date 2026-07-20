// Pure verification logic for the OCR review workflow — no database, no I/O, so
// it's directly unit-testable (see verify.test.ts). data.ts wires these to the
// OCR call and the DB; nothing here decides an outcome on its own beyond
// "matches" vs "needs a human".
import type { ReviewStatus } from "#/lib/types";
import type { OcrVerification } from "./ocr";

// How well the receipt must fit the chosen category to pass (0..1). Below this,
// the category is treated as wrong/unclear and the transaction is flagged.
export const CATEGORY_THRESHOLD = 0.6;
// Below this overall confidence we can't trust the read at all → flag for review.
export const CONFIDENCE_THRESHOLD = 0.4;

export interface EnteredFields {
	amount: number;
	date: string; // YYYY-MM-DD
}

export interface CompareResult {
	amountMatch: boolean;
	dateMatch: boolean;
	categoryOk: boolean;
	needsCheck: boolean;
}

/** Compare what the branch typed against the OCR read. Amount and date must match
 *  EXACTLY (a null/unreadable field never matches); category must clear the
 *  confidence threshold. Any failure — or an untrustworthy overall read — routes
 *  the transaction to human review. */
export function compareReceipt(
	entered: EnteredFields,
	ocr: OcrVerification,
): CompareResult {
	const amountMatch =
		ocr.ocrAmount !== null && ocr.ocrAmount === entered.amount;
	const dateMatch = ocr.ocrDate !== null && ocr.ocrDate === entered.date;
	const categoryOk = ocr.categoryFits >= CATEGORY_THRESHOLD;
	const lowConfidence = ocr.overallConfidence < CONFIDENCE_THRESHOLD;
	const needsCheck = lowConfidence || !(amountMatch && dateMatch && categoryOk);
	return { amountMatch, dateMatch, categoryOk, needsCheck };
}

/** Where a transaction lands after a verify pass. A first-pass check (modifyCount
 *  0) resolves to ok/need_check; any re-check after HQ requested a modify always
 *  routes back to HQ as `after_modify_check` (HQ decides via the 3 buttons). */
export function nextStatusAfterVerify(
	modifyCount: number,
	needsCheck: boolean,
): ReviewStatus {
	if (modifyCount > 0) return "after_modify_check";
	return needsCheck ? "need_check" : "ok";
}

// --------------------------------------------------------------------------
// Transition guards — which HQ/branch actions are legal from a given status.
// --------------------------------------------------------------------------

/** HQ may reject a flagged transaction (first flag or after a modify round). */
export function canCancel(status: ReviewStatus): boolean {
	return status === "need_check" || status === "after_modify_check";
}

/** HQ may return a flagged transaction to the branch to correct. */
export function canModify(status: ReviewStatus): boolean {
	return status === "need_check" || status === "after_modify_check";
}

/** HQ may approve/confirm any flagged transaction — its decision outranks OCR,
 *  so "Correct" is available both on a first-pass flag and after a modify round. */
export function canCorrect(status: ReviewStatus): boolean {
	return status === "need_check" || status === "after_modify_check";
}

/** Where an HQ "Correct" lands: after a modify round it's a confirmed correction;
 *  on a first-pass flag it's simply HQ approving the entry as-is (normal). */
export function statusAfterCorrect(status: ReviewStatus): ReviewStatus {
	return status === "after_modify_check" ? "correct_modification" : "ok";
}

/** The branch may edit only a transaction HQ has returned to them. */
export function canBranchEdit(status: ReviewStatus): boolean {
	return status === "modify_requested";
}
