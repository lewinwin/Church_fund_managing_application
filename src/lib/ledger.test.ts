import { describe, expect, it } from "vitest";
import { ledgerFor, spentOf } from "./ledger";
import type { AppData, Expense, ReviewStatus } from "./types";

function expense(over: Partial<Expense>): Expense {
	return {
		id: over.id ?? "e",
		branchId: over.branchId ?? "b1",
		submittedByUserId: "u",
		description: "x",
		expenseDate: "2026-07-01",
		localAmount: over.localAmount ?? 0,
		localCurrency: "SGD",
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
			expense({ id: "e1", localAmount: 100, categoryId: "c-meals" }),
			expense({ id: "e2", localAmount: 50, categoryId: "c-fuel" }),
			// Cancelled — must be excluded from every money figure.
			expense({
				id: "e3",
				localAmount: 1000,
				categoryId: "c-meals",
				reviewStatus: "cancelled" as ReviewStatus,
			}),
		],
		fundingPlans: [
			{
				id: "p1",
				branchId: "b1",
				totalTarget: 400,
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
				amount: 300,
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
		expect(led.spent).toBe(150);
	});

	it("reconciles remaining = released − spent, in the branch currency", () => {
		expect(led.currency).toBe("SGD");
		expect(led.released).toBe(300);
		expect(led.remaining).toBe(150);
		expect(led.target).toBe(400);
	});

	it("byCategory excludes cancelled too", () => {
		const total = led.byCategory.reduce((s, c) => s + c.amount, 0);
		expect(total).toBe(150);
		// the 1000 cancelled meal must not appear
		const meals = led.byCategory.find((c) => c.categoryId === "c-meals");
		expect(meals?.amount).toBe(100);
	});
});

describe("spentOf", () => {
	it("sums only non-cancelled over an arbitrary subset", () => {
		const { expenses } = fixture();
		expect(spentOf(expenses)).toBe(150);
	});
});
