import { describe, expect, it } from "vitest";
import type { OcrVerification } from "./ocr";
import {
	canBranchEdit,
	canCancel,
	canCorrect,
	canModify,
	compareReceipt,
	nextStatusAfterVerify,
	statusAfterCorrect,
} from "./verify";

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

describe("nextStatusAfterVerify", () => {
	it("first pass → ok when clean", () => {
		expect(nextStatusAfterVerify(0, false)).toBe("ok");
	});
	it("first pass → need_check when flagged", () => {
		expect(nextStatusAfterVerify(0, true)).toBe("need_check");
	});
	it("after a modify round always routes to HQ, regardless of the read", () => {
		expect(nextStatusAfterVerify(1, false)).toBe("after_modify_check");
		expect(nextStatusAfterVerify(2, true)).toBe("after_modify_check");
	});
});

describe("transition guards", () => {
	it("Cancel/Modify allowed only from flagged states", () => {
		for (const s of ["need_check", "after_modify_check"] as const) {
			expect(canCancel(s)).toBe(true);
			expect(canModify(s)).toBe(true);
		}
		for (const s of [
			"ok",
			"checking",
			"cancelled",
			"modify_requested",
		] as const) {
			expect(canCancel(s)).toBe(false);
			expect(canModify(s)).toBe(false);
		}
	});

	it("Correct allowed on any flagged state (HQ decision is final)", () => {
		expect(canCorrect("after_modify_check")).toBe(true);
		expect(canCorrect("need_check")).toBe(true);
		expect(canCorrect("ok")).toBe(false);
		expect(canCorrect("cancelled")).toBe(false);
	});

	it("Correct lands on the right status per source", () => {
		// After a modify round → confirmed correction; first-pass flag → plain ok.
		expect(statusAfterCorrect("after_modify_check")).toBe(
			"correct_modification",
		);
		expect(statusAfterCorrect("need_check")).toBe("ok");
	});

	it("branch edit allowed only on a returned transaction", () => {
		expect(canBranchEdit("modify_requested")).toBe(true);
		expect(canBranchEdit("need_check")).toBe(false);
		expect(canBranchEdit("after_modify_check")).toBe(false);
	});
});
