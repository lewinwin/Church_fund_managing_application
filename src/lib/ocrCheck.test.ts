import { describe, expect, it } from "vitest";
import { type OcrCheck, parseOcrCheck } from "./ocrCheck";

const sample: OcrCheck = {
	ocrAmount: 45.8,
	ocrDate: "2026-06-24",
	ocrCurrency: "SGD",
	ocrCategoryGuess: "Meals",
	categoryFits: 0.95,
	overallConfidence: 0.9,
	amountMatch: true,
	dateMatch: true,
	categoryOk: true,
	needsCheck: false,
	checkedAt: "2026-07-20T10:00:00Z",
};

describe("parseOcrCheck", () => {
	it("round-trips a stored check (jsonb → typed)", () => {
		// jsonb persists as a plain object; parse must recover the exact record.
		const roundTripped = parseOcrCheck(JSON.parse(JSON.stringify(sample)));
		expect(roundTripped).toEqual(sample);
	});

	it("returns null for the pre-check value and legacy/garbage blobs", () => {
		expect(parseOcrCheck(null)).toBeNull();
		expect(parseOcrCheck(undefined)).toBeNull();
		expect(parseOcrCheck("nope")).toBeNull();
		expect(parseOcrCheck([1, 2, 3])).toBeNull();
		// legacy blob without the discriminating fields
		expect(parseOcrCheck({ error: "no receipt" })).toBeNull();
	});

	it("coerces malformed fields to safe defaults rather than throwing", () => {
		const r = parseOcrCheck({
			amountMatch: true,
			checkedAt: "2026-07-20T10:00:00Z",
			categoryFits: "bad",
			ocrAmount: "x",
		});
		expect(r?.categoryFits).toBe(0);
		expect(r?.ocrAmount).toBeNull();
		expect(r?.dateMatch).toBe(false);
	});
});
