// Formatting helpers for money, dates and percentages.
import type { CurrencyCode } from "#/lib/types";

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
	USD: "en-US",
	SGD: "en-SG",
	ZAR: "en-ZA",
	MWK: "en-MW",
	CRC: "es-CR",
};

// Currencies with effectively no minor unit in everyday use.
const ZERO_DECIMAL: CurrencyCode[] = ["MWK", "CRC"];

export function formatMoney(amount: number, currency: CurrencyCode): string {
	const fractionDigits = ZERO_DECIMAL.includes(currency) ? 0 : 2;
	try {
		return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits,
		}).format(amount);
	} catch {
		return `${currency} ${amount.toFixed(fractionDigits)}`;
	}
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
