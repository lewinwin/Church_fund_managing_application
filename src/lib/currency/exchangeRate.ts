// Exchange Rate Service — W1 mock.
// Fixed rates only. Real provider (Open Exchange Rates / Fixer) lands W3.
// Interface matches context.md's getExchangeRateToUsd contract so the UI
// never changes when the real provider is wired in.
import { type CurrencyCode, KNOWN_CURRENCIES } from "#/lib/types";

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

/** Minimal shape needed from a branch to resolve currencies/rates. */
interface BranchRate {
	localCurrency: CurrencyCode;
	exchangeRateToUsd: number;
}

/**
 * Every currency the system knows about: the caller's own branch first, then any
 * other branch's currency, then the built-ins. Branches created at runtime (VND,
 * THB, …) therefore appear everywhere, not just in their own branch.
 */
export function availableCurrencies(
	ownCurrency: CurrencyCode,
	branches: BranchRate[],
): CurrencyCode[] {
	const seen = new Set<CurrencyCode>([ownCurrency]);
	const out: CurrencyCode[] = [ownCurrency];
	for (const c of [
		...branches.map((b) => b.localCurrency),
		...KNOWN_CURRENCIES,
	]) {
		if (!seen.has(c)) {
			seen.add(c);
			out.push(c);
		}
	}
	return out;
}

/**
 * The rate to use for an amount entered in `currency`. Prefers the branch that
 * actually uses that currency (HQ set its rate), falling back to the built-in
 * fixed table. Without this a runtime currency would silently rate at 1.0.
 */
export function rateForCurrency(
	currency: CurrencyCode,
	branches: BranchRate[],
): number {
	const owner = branches.find((b) => b.localCurrency === currency);
	if (owner && owner.exchangeRateToUsd > 0) return owner.exchangeRateToUsd;
	return rateToUsd(currency);
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

/** Convert a local amount to USD using an explicit rate (1 local = rate USD).
 *  Full precision (no cent-rounding) so low-value currencies (VND, MWK) round-
 *  trip exactly; display formatters round as needed. */
export function toUsd(localAmount: number, rate: number): number {
	return localAmount * rate;
}

/** Convert a USD amount to local using an explicit rate (display only). */
export function usdToLocal(usdAmount: number, rate: number): number {
	if (rate === 0) return 0;
	return usdAmount / rate;
}

export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
