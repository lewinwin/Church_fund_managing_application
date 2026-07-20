import { describe, expect, it } from "vitest";
import { availableCurrencies, rateForCurrency, toUsd } from "./exchangeRate";

// Branches created at runtime carry currencies the built-in table never had.
const branches = [
	{ localCurrency: "SGD", exchangeRateToUsd: 0.741 },
	{ localCurrency: "VND", exchangeRateToUsd: 0.0000395 },
	{ localCurrency: "THB", exchangeRateToUsd: 0.0275 },
];

describe("availableCurrencies", () => {
	it("puts the caller's own currency first", () => {
		expect(availableCurrencies("VND", branches)[0]).toBe("VND");
	});

	it("includes other branches' runtime currencies, not just the built-ins", () => {
		const list = availableCurrencies("VND", branches);
		expect(list).toContain("THB"); // another runtime branch
		expect(list).toContain("USD"); // built-in
		expect(list).toContain("MWK"); // built-in
	});

	it("never repeats a currency", () => {
		const list = availableCurrencies("SGD", branches);
		expect(new Set(list).size).toBe(list.length);
	});

	it("works when no branches exist yet", () => {
		expect(availableCurrencies("USD", [])).toContain("USD");
	});
});

describe("rateForCurrency", () => {
	it("uses the rate of the branch that owns that currency", () => {
		expect(rateForCurrency("THB", branches)).toBe(0.0275);
		expect(rateForCurrency("VND", branches)).toBe(0.0000395);
	});

	it("falls back to the built-in fixed rate", () => {
		expect(rateForCurrency("MWK", branches)).toBe(0.000578);
	});

	it("does NOT silently rate an unknown currency at 1:1 when a branch has it", () => {
		// The bug this guards: a THB amount converted at 1.0 would be ~36x too big.
		const usd = toUsd(1000, rateForCurrency("THB", branches));
		expect(usd).toBeCloseTo(27.5, 5);
		expect(usd).not.toBe(1000);
	});
});
