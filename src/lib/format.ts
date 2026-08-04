// Formatting helpers for money, dates and percentages.
import type { CurrencyCode } from "#/lib/types";

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
	USD: "en-US",
	SGD: "en-SG",
	ZAR: "en-ZA",
	MWK: "en-MW",
	CRC: "es-CR",
};

// Currencies we deliberately show without minor units, even though ISO defines
// them (they're not used in everyday practice).
const ZERO_DECIMAL: CurrencyCode[] = ["MWK", "CRC"];

/** Decimal places for a currency. Explicit overrides first, otherwise ask Intl —
 *  so a branch created with a new currency (VND has 0 minor units, THB has 2)
 *  formats correctly without touching this file. */
function decimalsFor(currency: CurrencyCode): number {
	if (ZERO_DECIMAL.includes(currency)) return 0;
	try {
		return (
			new Intl.NumberFormat("en-US", {
				style: "currency",
				currency,
			}).resolvedOptions().maximumFractionDigits ?? 2
		);
	} catch {
		return 2;
	}
}

/** Money with the currency's ISO CODE rather than its symbol, e.g. "ZAR 640,00"
 *  (not "R 640,00"). Codes are unambiguous across branches — several currencies
 *  share the "$" / "R" glyphs — so the whole app names the currency explicitly. */
export function formatMoney(amount: number, currency: CurrencyCode): string {
	const fractionDigits = decimalsFor(currency);
	try {
		return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
			style: "currency",
			currency,
			currencyDisplay: "code",
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits,
		}).format(amount);
	} catch {
		return `${currency} ${amount.toFixed(fractionDigits)}`;
	}
}

/** Number only, no currency symbol, with the currency's usual decimals.
 *  Used where the unit is shown once elsewhere (e.g. the fund-balance card). */
export function formatAmount(amount: number, currency: CurrencyCode): string {
	const fractionDigits = decimalsFor(currency);
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(amount);
}

export function formatUsd(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

export function formatUsdCompact(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(amount);
}

export function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

export function formatPercent(fraction: number, digits = 0): string {
	return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
	if (!iso) return "—";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export function formatDateTime(iso: string): string {
	if (!iso) return "—";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** YYYY-MM-DD for <input type="date"> defaults. */
export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

export function initials(name: string): string {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase() ?? "")
		.join("");
}
