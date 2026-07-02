// Exchange Rate Service — W1 mock.
// Fixed rates only. Real provider (Open Exchange Rates / Fixer) lands W3.
// Interface matches context.md's getExchangeRateToUsd contract so the UI
// never changes when the real provider is wired in.
import type { CurrencyCode } from "#/lib/types";

/** local currency -> USD multiplier. 1 local unit = RATE usd. */
const FIXED_RATES: Record<CurrencyCode, number> = {
	USD: 1,
	SGD: 0.741,
	ZAR: 0.0556,
	MWK: 0.000578,
	CRC: 0.00196,
};

export interface ExchangeRateResult {
	rate: number;
	source: string;
	fetchedAt: string;
}

/** Synchronous helper for calculations that need the raw multiplier. */
export function rateToUsd(currency: CurrencyCode): number {
	return FIXED_RATES[currency] ?? 1;
}

/**
 * Mirrors the production async signature. In W1 it resolves instantly from
 * the fixed table; the `date` param is accepted but ignored (no historical
 * rates in the mock).
 */
export function getExchangeRateToUsd(
	currency: CurrencyCode,
): ExchangeRateResult {
	return {
		rate: rateToUsd(currency),
		source: "mock-fixed-rates",
		fetchedAt: new Date().toISOString(),
	};
}

/** Convert a local amount to USD using the fixed rate. */
export function toUsd(localAmount: number, currency: CurrencyCode): number {
	return round2(localAmount * rateToUsd(currency));
}

/** Convert a USD amount to a branch's local currency (display only). */
export function usdToLocal(usdAmount: number, currency: CurrencyCode): number {
	const rate = rateToUsd(currency);
	if (rate === 0) return 0;
	return usdAmount / rate;
}

export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
