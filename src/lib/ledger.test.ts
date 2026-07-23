import { describe, expect, it } from "vitest";
import { globalLedger, ledgerFor, spentUsdOf } from "./ledger";
import type { AppData, Expense, ReviewStatus } from "./types";

function expense(over: Partial<Expense>): Expense {
	return {
		id: over.id ?? "e",
		branchId: over.branchId ?? "b1",
		submittedByUserId: "u",
		description: "x",
		expenseDate: "2026-07-01",
		localAmount: 0,
		localCurrency: "USD",
		exchangeRateToUsd: 1,
		usdAmount: over.usdAmount ?? 0,
		categoryId: over.categoryId ?? "c-meals",
		otherSubcategoryId: null,
		receiptFileName: null,
		receiptDataUrl: null,
		ocrConfidence: null,
		ocrCheck: null,
		reviewStatus: over.reviewStatus ?? "ok",
		reviewNote: null,
		modifyCount: 0,
		createdAt: "2026-07-01T00:00:00Z",
		...over,
	};
}

function fixture(): AppData {
	return {
		branches: [
			{
				id: "b1",
				name: "B1",
				country: "X",
				localCurrency: "SGD",
				exchangeRateToUsd: 0.5, // 1 SGD = $0.50
				createdAt: "2026-01-01",
			},
		],
		users: [],
		categories: [
			{
				id: "c-meals",
				name: "Meals",
				parentId: null,
				active: true,
				createdAt: "",
			},
			{
				id: "c-fuel",
				name: "Fuel",
				parentId: null,
				active: true,
				createdAt: "",
			},
		],
		expenses: [
			expense({ id: "e1", usdAmount: 100, categoryId: "c-meals" }),
			expense({ id: "e2", usdAmount: 50, categoryId: "c-fuel" }),
			// Cancelled — must be excluded from every money figure.
			expense({
				id: "e3",
				usdAmount: 1000,
				categoryId: "c-meals",
				reviewStatus: "cancelled" as ReviewStatus,
			}),
		],
		fundingPlans: [
			{
				id: "p1",
				branchId: "b1",
				totalTargetUsd: 400,
				description: "",
				status: "active",
				createdAt: "",
			},
		],
		fundReleases: [
			{
				id: "r1",
				fundingPlanId: "p1",
				branchId: "b1",
				amountUsd: 300,
				releaseDate: "2026-06-01",
				note: null,
				createdByUserId: "u",
				createdAt: "",
			},
		],
	};
}

describe("ledgerFor", () => {
	const led = ledgerFor(fixture(), "b1");

	it("excludes cancelled from spent (100 + 50, not + 1000)", () => {
		expect(led.spentUsd).toBe(150);
	});

	it("reconciles remaining = released − spent", () => {
		expect(led.releasedUsd).toBe(300);
		expect(led.remainingUsd).toBe(150);
	});

	it("mirrors figures in the branch's local currency", () => {
		expect(led.currency).toBe("SGD");
		expect(led.releasedLocal).toBe(600); // 300 / 0.5
		expect(led.spentLocal).toBe(300);
		expect(led.remainingLocal).toBe(300);
		expect(led.targetLocal).toBe(800); // 400 / 0.5
	});

	it("byCategory excludes cancelled too", () => {
		const total = led.byCategory.reduce((s, c) => s + c.usd, 0);
		expect(total).toBe(150);
		// the 1000 cancelled meal must not appear
		const meals = led.byCategory.find((c) => c.categoryId === "c-meals");
		expect(meals?.usd).toBe(100);
	});
});

describe("spentUsdOf", () => {
	it("sums only non-cancelled over an arbitrary subset", () => {
		const { expenses } = fixture();
		expect(spentUsdOf(expenses)).toBe(150);
	});
});

describe("globalLedger", () => {
	it("aggregates across branches excluding cancelled", () => {
		const g = globalLedger(fixture());
		expect(g.releasedUsd).toBe(300);
		expect(g.spentUsd).toBe(150);
		expect(g.remainingUsd).toBe(150);
	});
});
