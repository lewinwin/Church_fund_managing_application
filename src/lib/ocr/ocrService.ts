// OCR Service — W1 mock.
// Real OCR (Google Vision / Textract / Mindee) lands W3. This stub simulates
// latency then returns plausible extracted fields, or an empty low-confidence
// result on the "simulate failure" path. Human correction is source of truth.
import type { CurrencyCode } from "#/lib/types";

export interface OcrResult {
	amount?: number;
	currency?: CurrencyCode;
	date?: string;
	merchantName?: string;
	confidence?: number;
	raw?: Record<string, unknown>;
}

const SAMPLE_MERCHANTS = [
	"FairPrice",
	"Cold Storage",
	"Shell Station",
	"Office Depot",
	"Corner Cafe",
	"City Pharmacy",
	"Metro Hardware",
	"Sunrise Bakery",
];

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomAmount(currency: CurrencyCode): number {
	// Roughly branch-appropriate magnitudes.
	switch (currency) {
		case "MWK":
			return Math.round((20000 + Math.random() * 300000) / 100) * 100;
		case "CRC":
			return Math.round((5000 + Math.random() * 90000) / 50) * 50;
		case "ZAR":
			return Math.round((80 + Math.random() * 2500) * 100) / 100;
		default:
			return Math.round((5 + Math.random() * 300) * 100) / 100;
	}
}

function recentDateIso(): string {
	const d = new Date();
	d.setDate(d.getDate() - Math.floor(Math.random() * 14));
	return d.toISOString().slice(0, 10);
}

export interface ExtractOptions {
	/** Branch currency used to shape a plausible amount. */
	currency: CurrencyCode;
	/** Force the OCR-failure path (empty fields, low confidence). */
	simulateFailure?: boolean;
	/** Override the simulated latency (ms). */
	delayMs?: number;
}

export function extractReceiptData(
	_file: File | null,
	opts: ExtractOptions,
): Promise<OcrResult> {
	const delay = opts.delayMs ?? 1400;

	return new Promise((resolve) => {
		setTimeout(() => {
			if (opts.simulateFailure) {
				resolve({
					confidence: 0.12,
					raw: { status: "low_confidence", engine: "mock-ocr" },
				});
				return;
			}

			const amount = randomAmount(opts.currency);
			const merchantName = pick(SAMPLE_MERCHANTS);
			const date = recentDateIso();
			const confidence = Math.round((0.72 + Math.random() * 0.26) * 100) / 100;

			resolve({
				amount,
				currency: opts.currency,
				date,
				merchantName,
				confidence,
				raw: {
					status: "ok",
					engine: "mock-ocr",
					fields: { amount, merchantName, date },
				},
			});
		}, delay);
	});
}
