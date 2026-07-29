import { describe, expect, it } from "vitest";
import {
	parseMoney,
	parseReceiptDate,
	parseReceiptFields,
} from "./receiptParse";

describe("parseMoney", () => {
	it("reads a plain dot-decimal amount", () => {
		expect(parseMoney("498.72")).toBe(498.72);
	});
	it("reads comma-thousands with dot-decimal (US/SG)", () => {
		expect(parseMoney("1,234.56")).toBe(1234.56);
	});
	it("reads comma-decimal (ZAR)", () => {
		expect(parseMoney("498,72")).toBe(498.72);
	});
	it("reads space-thousands with comma-decimal (ZAR)", () => {
		expect(parseMoney("1 000,00")).toBe(1000);
	});
	it("reads dot-thousands with comma-decimal (EU)", () => {
		expect(parseMoney("1.234,56")).toBe(1234.56);
	});
	it("treats three trailing digits after a single separator as thousands", () => {
		expect(parseMoney("1,234")).toBe(1234);
	});
	it("returns null for a non-number", () => {
		expect(parseMoney("R")).toBeNull();
	});
});

describe("parseReceiptDate", () => {
	it("reads an ISO date", () => {
		expect(parseReceiptDate("Date 2026-03-22 14:55")).toBe("2026-03-22");
	});
	it("reads a day-first slash date", () => {
		expect(parseReceiptDate("Date 22/03/2026")).toBe("2026-03-22");
	});
	it("swaps to month-first when the first part cannot be a day", () => {
		expect(parseReceiptDate("03/22/2026")).toBe("2026-03-22");
	});
	it("reads a 'DD Mon YYYY' date", () => {
		expect(parseReceiptDate("11 Mar 2026")).toBe("2026-03-11");
	});
	it("reads a 'Mon DD, YYYY' date", () => {
		expect(parseReceiptDate("Mar 11, 2026")).toBe("2026-03-11");
	});
	it("returns null when there is no date", () => {
		expect(parseReceiptDate("no date on this line")).toBeNull();
	});
});

describe("parseReceiptFields", () => {
	const receipt = [
		"GROCERY MART",
		"Milk 2.50",
		"Bread 3.20",
		"Subtotal 5.70",
		"TOTAL 498.72",
		"DATE 2026-03-22",
	].join("\n");

	it("prefers the labelled TOTAL over subtotal and line items", () => {
		const r = parseReceiptFields(receipt);
		expect(r.amount).toBe(498.72);
		expect(r.date).toBe("2026-03-22");
		expect(r.amountLabeled).toBe(true);
	});

	it("never picks the subtotal as the amount", () => {
		expect(parseReceiptFields(receipt).amount).not.toBe(5.7);
	});

	it("falls back to the largest value when no total label exists", () => {
		const r = parseReceiptFields("Item A 10.00\nItem B 45.80\nTax 2.00");
		expect(r.amount).toBe(45.8);
		expect(r.amountLabeled).toBe(false);
	});

	it("handles a comma-decimal total with a currency prefix", () => {
		const r = parseReceiptFields("Checkers\nTOTAL  R 1 000,00\n11 Mar 2026");
		expect(r.amount).toBe(1000);
		expect(r.date).toBe("2026-03-11");
	});

	it("returns nulls for text with no amount or date", () => {
		const r = parseReceiptFields("thank you for shopping");
		expect(r.amount).toBeNull();
		expect(r.date).toBeNull();
	});
});
