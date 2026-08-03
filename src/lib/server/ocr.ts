// OCR provider dispatcher. Which engine verifies receipts is a DEVELOPER config,
// selected by the OCR_PROVIDER env var — there is no user-facing selector.
//   OCR_PROVIDER=gemini    → cloud Gemini (needs GEMINI_API_KEY). Default.
//   OCR_PROVIDER=tesseract → fully local Tesseract + PDF text/render (no key).
// Both providers implement the same OcrVerification contract, so the rest of the
// app (data.ts → compareReceipt) is unchanged. Add a future provider by writing
// an ocr<Name>.ts that returns OcrVerification and wiring it below. Server-only.
import process from "node:process";
import type { CurrencyCode } from "#/lib/types";
import { runGeminiVerification, runReceiptOcr } from "./ocrGemini";
import { runTesseractVerification } from "./ocrTesseract";

export interface OcrExtraction {
	amount: number | null;
	currency: CurrencyCode | null;
	date: string | null; // YYYY-MM-DD
	description: string | null;
	confidence: number; // 0..1
}

export interface OcrVerification {
	ocrAmount: number | null;
	ocrDate: string | null; // YYYY-MM-DD
	ocrCurrency: CurrencyCode | null;
	/** The provider's best-fit category name (Tesseract always null). */
	ocrCategoryGuess: string | null;
	/** 0..1 — how well the receipt fits the branch's CHOSEN category (Tesseract: 1). */
	categoryFits: number;
	/** 0..1 — overall confidence the receipt was read reliably. */
	overallConfidence: number;
}

/** What the branch TYPED — used by providers that judge the category (Gemini).
 *  Tesseract ignores it. */
export interface VerifyCtx {
	enteredAmount: number;
	enteredDate: string;
	chosenCategory: string;
	categoryNames: string[];
}

export type OcrProvider = "gemini" | "tesseract";

/** The selected provider, resolved once from OCR_PROVIDER (default: gemini). */
export const OCR_PROVIDER: OcrProvider =
	process.env.OCR_PROVIDER?.toLowerCase() === "tesseract"
		? "tesseract"
		: "gemini";

/** Verify a submitted expense against its receipt using the configured provider.
 *  Never throws — providers return a null/zero-confidence result on failure so
 *  the caller routes the transaction to `need_check`. */
export function runReceiptVerification(
	dataUrl: string,
	ctx: VerifyCtx,
): Promise<OcrVerification> {
	return OCR_PROVIDER === "tesseract"
		? runTesseractVerification(dataUrl)
		: runGeminiVerification(dataUrl, ctx);
}

// Legacy raw pre-fill extraction (Gemini only; unused by the submit flow).
export { runReceiptOcr };
