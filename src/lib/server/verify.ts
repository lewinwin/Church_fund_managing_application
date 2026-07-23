// OCR comparison: does what the branch TYPED match what the receipt says? Pure —
// no database, no I/O — so it's directly unit-testable (verify.test.ts). This
// module answers only "matches" vs "needs a human"; where that result routes a
// transaction, and every other lifecycle rule, lives in reviewLifecycle.ts.
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
