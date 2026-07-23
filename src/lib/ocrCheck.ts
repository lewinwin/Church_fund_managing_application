// The OCR verification record: the single definition of what a receipt check
// produces and how it reads back. It is persisted in the expenses.ocr_raw jsonb
// column, but only ever written and read through this module — the type is the
// contract, so a renamed field is a compile error end-to-end instead of a silent
// null at the render site.
export interface OcrCheck {
	/** Fields the model read off the receipt (null = unreadable / not present). */
	ocrAmount: number | null;
	ocrDate: string | null; // YYYY-MM-DD
	ocrCurrency: string | null;
	ocrCategoryGuess: string | null;
	/** 0..1 how well the receipt fits the chosen category. */
	categoryFits: number;
	/** 0..1 overall confidence the receipt was read reliably. */
	overallConfidence: number;
	/** Comparison outcome vs what the branch typed. */
	amountMatch: boolean;
	dateMatch: boolean;
	categoryOk: boolean;
	/** Whether the check routes the transaction to human review. */
	needsCheck: boolean;
	/** ISO timestamp of when the check ran. */
	checkedAt: string;
}

function num(v: unknown): number | null {
	return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
	return typeof v === "string" && v.length > 0 ? v : null;
}

/** Parse the jsonb blob back into a typed OcrCheck, or null if it isn't one
 *  (legacy rows, the pre-check `null`, or a malformed value). The single reader. */
export function parseOcrCheck(raw: unknown): OcrCheck | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const o = raw as Record<string, unknown>;
	if (!("amountMatch" in o) || !("checkedAt" in o)) return null;
	return {
		ocrAmount: num(o.ocrAmount),
		ocrDate: str(o.ocrDate),
		ocrCurrency: str(o.ocrCurrency),
		ocrCategoryGuess: str(o.ocrCategoryGuess),
		categoryFits: num(o.categoryFits) ?? 0,
		overallConfidence: num(o.overallConfidence) ?? 0,
		amountMatch: o.amountMatch === true,
		dateMatch: o.dateMatch === true,
		categoryOk: o.categoryOk === true,
		needsCheck: o.needsCheck === true,
		checkedAt: str(o.checkedAt) ?? "",
	};
}
