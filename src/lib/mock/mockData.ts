// UI-only demo data. This branch runs entirely on this fixture — no database,
// no auth server, no real OCR. The expenses below deliberately cover EVERY
// review state so the OCR-verification UI (Need-to-Check warnings, the compare
// box, Returned/After-Modify/Cancelled/Corrected badges) is all visible without
// a backend.
import { buildSeedData } from "#/data/seed";
import type { OcrCheck } from "#/lib/ocrCheck";
import type { AppData, CurrencyCode, Expense, ReviewStatus } from "#/lib/types";

const RATE: Record<string, number> = {
	SGD: 0.741,
	MWK: 0.000578,
	ZAR: 0.0556,
	CRC: 0.00196,
};
const round2 = (n: number) => Math.round(n * 100) / 100;

let seq = 0;
function exp(o: {
	branchId: string;
	userId: string;
	desc: string;
	date: string;
	local: number;
	currency: CurrencyCode;
	categoryId: string;
	subId?: string | null;
	status: ReviewStatus;
	note?: string | null;
	modifyCount?: number;
	check?: OcrCheck | null;
}): Expense {
	const rate = RATE[o.currency] ?? 1;
	seq += 1;
	return {
		id: `exp-demo-${seq}`,
		branchId: o.branchId,
		submittedByUserId: o.userId,
		description: o.desc,
		expenseDate: o.date,
		localAmount: o.local,
		localCurrency: o.currency,
		exchangeRateToUsd: rate,
		usdAmount: round2(o.local * rate),
		categoryId: o.categoryId,
		otherSubcategoryId: o.subId ?? null,
		receiptFileName: "receipt.jpg",
		receiptDataUrl: null,
		ocrConfidence: o.check?.overallConfidence ?? null,
		ocrCheck: o.check ?? null,
		reviewStatus: o.status,
		reviewNote: o.note ?? null,
		modifyCount: o.modifyCount ?? 0,
		createdAt: `${o.date}T09:00:00Z`,
	};
}

// A comparison record. `bad` marks which field(s) mismatch so the compare box
// shows red ✗ / green ✓ realistically.
function check(o: {
	local: number;
	date: string;
	currency: CurrencyCode;
	categoryGuess: string;
	bad?: ("amount" | "date" | "category")[];
}): OcrCheck {
	const bad = new Set(o.bad ?? []);
	const amountMatch = !bad.has("amount");
	const dateMatch = !bad.has("date");
	const categoryOk = !bad.has("category");
	return {
		// when a field is "bad", the OCR read differs from what was entered
		ocrAmount: amountMatch ? o.local : round2(o.local * 1.18),
		ocrDate: dateMatch ? o.date : shiftDate(o.date, 40),
		ocrCurrency: o.currency,
		ocrCategoryGuess: o.categoryGuess,
		categoryFits: categoryOk ? 0.92 : 0.24,
		overallConfidence: 0.9,
		amountMatch,
		dateMatch,
		categoryOk,
		needsCheck: !(amountMatch && dateMatch && categoryOk),
		checkedAt: `${o.date}T09:01:00Z`,
	};
}

function shiftDate(iso: string, days: number): string {
	const d = new Date(iso);
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}

function demoExpenses(): Expense[] {
	return [
		// ── Singapore (SGD) — the richest branch, covers most states ──────────
		exp({
			branchId: "br-sg",
			userId: "u-sg",
			desc: "Killiney Kopitiam — Sunday refreshments",
			date: "2026-06-24",
			local: 45.8,
			currency: "SGD",
			categoryId: "cat-meals",
			status: "ok",
		}),
		exp({
			branchId: "br-sg",
			userId: "u-sg",
			desc: "Grab to airport",
			date: "2026-07-02",
			local: 45.0,
			currency: "SGD",
			categoryId: "cat-transport",
			status: "need_check",
			check: check({
				local: 45.0,
				date: "2026-07-02",
				currency: "SGD",
				categoryGuess: "Transportation",
				bad: ["amount"],
			}),
		}),
		exp({
			branchId: "br-sg",
			userId: "u-sg",
			desc: "Office chairs (corrected)",
			date: "2026-07-05",
			local: 120.0,
			currency: "SGD",
			categoryId: "cat-office",
			status: "after_modify_check",
			modifyCount: 1,
			note: "Date didn't match the receipt — please fix.",
			check: check({
				local: 120.0,
				date: "2026-07-05",
				currency: "SGD",
				categoryGuess: "Office Equipment",
			}),
		}),
		exp({
			branchId: "br-sg",
			userId: "u-sg",
			desc: "Team lunch",
			date: "2026-07-08",
			local: 88.0,
			currency: "SGD",
			categoryId: "cat-meals",
			status: "modify_requested",
			modifyCount: 1,
			note: "Amount doesn't match the receipt — please correct and resubmit.",
			check: check({
				local: 88.0,
				date: "2026-07-08",
				currency: "SGD",
				categoryGuess: "Meals & Hospitality",
				bad: ["amount"],
			}),
		}),
		exp({
			branchId: "br-sg",
			userId: "u-sg",
			desc: "Snacks (rejected)",
			date: "2026-07-09",
			local: 15.0,
			currency: "SGD",
			categoryId: "cat-meals",
			status: "cancelled",
			note: "Not a fundable expense — personal purchase.",
			check: check({
				local: 15.0,
				date: "2026-07-09",
				currency: "SGD",
				categoryGuess: "Other",
				bad: ["category"],
			}),
		}),
		exp({
			branchId: "br-sg",
			userId: "u-sg",
			desc: "Projector repair",
			date: "2026-07-10",
			local: 400.0,
			currency: "SGD",
			categoryId: "cat-other",
			subId: "sub-repair",
			status: "correct_modification",
			modifyCount: 1,
			check: check({
				local: 400.0,
				date: "2026-07-10",
				currency: "SGD",
				categoryGuess: "Equipment Repair",
			}),
		}),
		exp({
			branchId: "br-sg",
			userId: "u-sg",
			desc: "Stationery run",
			date: "2026-07-12",
			local: 32.5,
			currency: "SGD",
			categoryId: "cat-other",
			subId: "sub-stationery",
			status: "checking",
		}),

		// ── Malawi (MWK) — category mismatch flag ─────────────────────────────
		exp({
			branchId: "br-mw",
			userId: "u-mw",
			desc: "ESCOM electricity",
			date: "2026-06-12",
			local: 260000,
			currency: "MWK",
			categoryId: "cat-electricity",
			status: "ok",
		}),
		exp({
			branchId: "br-mw",
			userId: "u-mw",
			desc: "Fuel for church van (filed as Meals?)",
			date: "2026-07-03",
			local: 42000,
			currency: "MWK",
			categoryId: "cat-meals",
			status: "need_check",
			check: check({
				local: 42000,
				date: "2026-07-03",
				currency: "MWK",
				categoryGuess: "Vehicle Expenses",
				bad: ["category"],
			}),
		}),

		// ── South Africa (ZAR) — date mismatch flag ───────────────────────────
		exp({
			branchId: "br-za",
			userId: "u-za",
			desc: "City minibus assoc.",
			date: "2026-06-17",
			local: 850,
			currency: "ZAR",
			categoryId: "cat-transport",
			status: "ok",
		}),
		exp({
			branchId: "br-za",
			userId: "u-za",
			desc: "Sound system repair",
			date: "2026-07-06",
			local: 1200,
			currency: "ZAR",
			categoryId: "cat-other",
			subId: "sub-repair",
			status: "need_check",
			check: check({
				local: 1200,
				date: "2026-07-06",
				currency: "ZAR",
				categoryGuess: "Equipment Repair",
				bad: ["date"],
			}),
		}),

		// ── Costa Rica (CRC) — plain ok ───────────────────────────────────────
		exp({
			branchId: "br-cr",
			userId: "u-cr",
			desc: "Church supplies",
			date: "2026-06-28",
			local: 25000,
			currency: "CRC",
			categoryId: "cat-other",
			subId: "sub-church",
			status: "ok",
		}),
	];
}

/** The complete in-memory AppData for the UI-only demo. Static branches, users,
 *  categories, plans and releases come from the seed JSON; expenses are the
 *  hand-authored set above so every review state is on screen. */
export function buildMockData(): AppData {
	const base = buildSeedData();
	return { ...base, expenses: demoExpenses() };
}
