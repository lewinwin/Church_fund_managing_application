// Real receipt OCR via Gemini 2.5 Flash. Server-only — the API key must never
// reach the browser, so this module is imported solely by server functions.
// Human correction remains the source of truth; this only pre-fills the form.
import process from "node:process";
import type { CurrencyCode } from "#/lib/types";

export interface OcrExtraction {
	amount: number | null;
	currency: CurrencyCode | null;
	date: string | null; // YYYY-MM-DD
	description: string | null;
	confidence: number; // 0..1
}

// `gemini-flash-latest` tracks the current Flash model so it won't 404 when a
// pinned version is retired (as gemini-2.5-flash was for new accounts).
// Override via GEMINI_MODEL to pin a specific one (e.g. gemini-3.5-flash).
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
const VALID_CURRENCIES: CurrencyCode[] = ["SGD", "MWK", "ZAR", "CRC", "USD"];

const PROMPT = `Extract fields from this purchase receipt image. Respond with ONLY a JSON object of exactly this shape:
{"amount": number|null, "currency": string|null, "date": string|null, "description": string|null, "confidence": number}

- amount: the final total actually paid, digits only (no currency symbol, no thousands separators). Prefer the grand total / amount due.
- currency: 3-letter ISO code (one of SGD, MWK, ZAR, CRC, USD) if determinable, else null.
- date: the purchase date as YYYY-MM-DD, else null.
- description: a short summary of the purchase (vendor name and/or what was bought), max 8 words.
- confidence: a number from 0 to 1 for how confident you are in the extraction.

If this is not a readable receipt, use nulls with a low confidence.`;

const EMPTY: OcrExtraction = {
	amount: null,
	currency: null,
	date: null,
	description: null,
	confidence: 0,
};

/** Extract receipt fields from a `data:<mime>;base64,<...>` URL. Never throws —
 *  on any failure it returns an empty low-confidence result so the UI falls
 *  back to manual entry (submission is never blocked by OCR). */
export async function runReceiptOcr(dataUrl: string): Promise<OcrExtraction> {
	const key = process.env.GEMINI_API_KEY;
	if (!key) throw new Error("GEMINI_API_KEY is not set (see .env)");

	const match = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
	if (!match) return EMPTY;
	const [, mimeType, data] = match;

	try {
		const res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
			{
				method: "POST",
				headers: { "content-type": "application/json", "x-goog-api-key": key },
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{ inline_data: { mime_type: mimeType, data } },
								{ text: PROMPT },
							],
						},
					],
					generationConfig: {
						responseMimeType: "application/json",
						temperature: 0,
					},
				}),
			},
		);

		if (!res.ok) {
			console.error("Gemini OCR HTTP", res.status, await res.text());
			return EMPTY;
		}

		const json = (await res.json()) as {
			candidates?: { content?: { parts?: { text?: string }[] } }[];
		};
		const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!text) return EMPTY;

		const p = JSON.parse(text) as Record<string, unknown>;
		const currencyRaw =
			typeof p.currency === "string" ? p.currency.toUpperCase() : null;
		const currency =
			currencyRaw && VALID_CURRENCIES.includes(currencyRaw as CurrencyCode)
				? (currencyRaw as CurrencyCode)
				: null;

		return {
			amount:
				typeof p.amount === "number" && Number.isFinite(p.amount) && p.amount > 0
					? Math.round(p.amount * 100) / 100
					: null,
			currency,
			date: normalizeDate(p.date),
			description:
				typeof p.description === "string" && p.description.trim()
					? p.description.trim().slice(0, 120)
					: null,
			confidence:
				typeof p.confidence === "number"
					? Math.max(0, Math.min(1, p.confidence))
					: 0.5,
		};
	} catch (err) {
		console.error("Gemini OCR failed", err);
		return EMPTY;
	}
}

function normalizeDate(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
	return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
