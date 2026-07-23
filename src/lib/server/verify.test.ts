import { describe, expect, it } from "vitest";
import type { OcrVerification } from "./ocr";
import { compareReceipt } from "./verify";

// A confident, fully-matching read for amount 45.8 on 2026-06-24, category fits.
function ocr(over: Partial<OcrVerification> = {}): OcrVerification {
	return {
		ocrAmount: 45.8,
		ocrDate: "2026-06-24",
		ocrCurrency: "SGD",
		ocrCategoryGuess: "Meals",
		categoryFits: 0.95,
		overallConfidence: 0.9,
		...over,
	};
}
const entered = { amount: 45.8, date: "2026-06-24" };

describe("compareReceipt", () => {
	it("passes when amount, date and category all match with confidence", () => {
		const r = compareReceipt(entered, ocr());
		expect(r).toEqual({
			amountMatch: true,
			dateMatch: true,
			categoryOk: true,
			needsCheck: false,
		});
	});

	it("flags on an amount mismatch", () => {
		const r = compareReceipt(entered, ocr({ ocrAmount: 48.0 }));
		expect(r.amountMatch).toBe(false);
		expect(r.needsCheck).toBe(true);
	});

	it("flags on a date mismatch (strict exact)", () => {
		const r = compareReceipt(entered, ocr({ ocrDate: "2026-06-25" }));
		expect(r.dateMatch).toBe(false);
		expect(r.needsCheck).toBe(true);
	});

	it("flags when the receipt doesn't fit the chosen category", () => {
		const r = compareReceipt(entered, ocr({ categoryFits: 0.2 }));
		expect(r.categoryOk).toBe(false);
		expect(r.needsCheck).toBe(true);
	});

	it("flags an unreadable receipt (null fields)", () => {
		const r = compareReceipt(
			entered,
			ocr({
				ocrAmount: null,
				ocrDate: null,
				categoryFits: 0,
				overallConfidence: 0,
			}),
		);
		expect(r.needsCheck).toBe(true);
	});

	it("flags a low-confidence read even if fields happen to match", () => {
		const r = compareReceipt(entered, ocr({ overallConfidence: 0.1 }));
		expect(r.amountMatch).toBe(true);
		expect(r.needsCheck).toBe(true);
	});
});
