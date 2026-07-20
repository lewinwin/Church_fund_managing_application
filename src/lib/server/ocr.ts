// Receipt OCR via Gemini. Server-only — the API key must never reach the
// browser, so this module is imported solely by server functions.
//
// Two roles:
//  - runReceiptOcr: raw field extraction (legacy pre-fill; no longer used by the
//    submit form under the verification workflow, kept for reference/tools).
//  - runReceiptVerification: the auditor. Given what the branch TYPED, it reads
//    the receipt and reports amount/date/currency plus how well the receipt fits
//    the CHOSEN category. The caller (data.compareReceipt) turns this into a
//    match/needs-check decision. This module never decides an outcome.
import process from "node:process";
import type { CurrencyCode } from "#/lib/types";

export interface OcrExtraction {
	amount: number | null;
	currency: CurrencyCode | null;
	date: string | null; // YYYY-MM-DD
	description: string | null;
	confidence: number; // 0..1
}

export interface OcrVerification {
	ocrAmount: number | null;
	ocrDate: string | null; // YYYY-MM-DD
	ocrCurrency: CurrencyCode | null;
	/** The model's best-fit category name from the provided list (or null). */
	ocrCategoryGuess: string | null;
	/** 0..1 — how well the receipt content fits the branch's CHOSEN category. */
	categoryFits: number;
	/** 0..1 — overall confidence the receipt was read reliably. */
	overallConfidence: number;
}

// `gemini-flash-latest` tracks the current Flash model so it won't 404 when a
// pinned version is retired (as gemini-2.5-flash was for new accounts).
// Override via GEMINI_MODEL to pin a specific one.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

/** Call Gemini with an image + prompt, expecting a single JSON object back.
 *  Returns the parsed object, or null on any failure (never throws). */
async function geminiJson(
	dataUrl: string,
	prompt: string,
): Promise<Record<string, unknown> | null> {
	const key = process.env.GEMINI_API_KEY;
	if (!key) throw new Error("GEMINI_API_KEY is not set (see .env)");

	const match = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
	if (!match) return null;
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
								{ text: prompt },
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
			return null;
		}
		const json = (await res.json()) as {
			candidates?: { content?: { parts?: { text?: string }[] } }[];
		};
		const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
		if (!text) return null;
		return JSON.parse(text) as Record<string, unknown>;
	} catch (err) {
		console.error("Gemini OCR failed", err);
		return null;
	}
}

function parseAmount(v: unknown): number | null {
	return typeof v === "number" && Number.isFinite(v) && v > 0
		? Math.round(v * 100) / 100
		: null;
}

// Any 3-letter ISO code — branches can be created with currencies beyond the
// built-ins (VND, THB, …), so this must not be a fixed whitelist.
function parseCurrency(v: unknown): CurrencyCode | null {
	const raw = typeof v === "string" ? v.trim().toUpperCase() : null;
	return raw && /^[A-Z]{3}$/.test(raw) ? (raw as CurrencyCode) : null;
}

function normalizeDate(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
	return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function clamp01(v: unknown, fallback: number): number {
	return typeof v === "number" ? Math.max(0, Math.min(1, v)) : fallback;
}

const EXTRACT_PROMPT = `Extract fields from this purchase receipt image. Respond with ONLY a JSON object of exactly this shape:
{"amount": number|null, "currency": string|null, "date": string|null, "description": string|null, "confidence": number}

- amount: the final total actually paid, digits only (no currency symbol, no thousands separators). Prefer the grand total / amount due.
- currency: 3-letter ISO code (e.g. SGD, MWK, ZAR, CRC, USD, VND, THB) if determinable, else null.
- date: the purchase date as YYYY-MM-DD, else null.
- description: a short summary of the purchase (vendor name and/or what was bought), max 8 words.
- confidence: a number from 0 to 1 for how confident you are in the extraction.

If this is not a readable receipt, use nulls with a low confidence.`;

/** Raw extraction (legacy pre-fill). Never throws. */
export async function runReceiptOcr(dataUrl: string): Promise<OcrExtraction> {
	const empty: OcrExtraction = {
		amount: null,
		currency: null,
		date: null,
		description: null,
		confidence: 0,
	};
	const p = await geminiJson(dataUrl, EXTRACT_PROMPT);
	if (!p) return empty;
	return {
		amount: parseAmount(p.amount),
		currency: parseCurrency(p.currency),
		date: normalizeDate(p.date),
		description:
			typeof p.description === "string" && p.description.trim()
				? p.description.trim().slice(0, 120)
				: null,
		confidence: clamp01(p.confidence, 0.5),
	};
}

/** Verify a submitted expense against its receipt. Given the typed amount/date
 *  and the chosen category (plus the full active category list), read the
 *  receipt and report the fields + how well it fits the chosen category. Never
 *  throws — on failure returns a null/zero-confidence result so the caller routes
 *  the transaction to `need_check` (a human then looks). */
export async function runReceiptVerification(
	dataUrl: string,
	ctx: {
		enteredAmount: number;
		enteredDate: string;
		chosenCategory: string;
		categoryNames: string[];
	},
): Promise<OcrVerification> {
	const empty: OcrVerification = {
		ocrAmount: null,
		ocrDate: null,
		ocrCurrency: null,
		ocrCategoryGuess: null,
		categoryFits: 0,
		overallConfidence: 0,
	};

	const prompt = `You are auditing a petty-cash receipt against what a branch employee TYPED. Read the receipt image.

The employee categorised this expense as: "${ctx.chosenCategory}".
The valid expense categories are: ${ctx.categoryNames.map((c) => `"${c}"`).join(", ")}.

Respond with ONLY a JSON object of exactly this shape:
{"amount": number|null, "currency": string|null, "date": string|null, "categoryGuess": string|null, "categoryFits": number, "confidence": number}

- amount: the final total actually paid, digits only (no symbol, no thousands separators). Prefer the grand total / amount due.
- currency: 3-letter ISO code if determinable, else null.
- date: the purchase date as YYYY-MM-DD, else null.
- categoryGuess: which of the valid categories best fits what was actually bought, else null.
- categoryFits: a number 0 to 1 for how well the receipt RELATES to the employee's chosen category "${ctx.chosenCategory}". Judge the real-world MEANING, not the exact wording. Be generous: if the receipt's purchase reasonably belongs to that category — including synonyms, broader/narrower terms, or clearly related concepts — score it HIGH (0.8-1.0). For example a fuel, taxi, parking or car-repair receipt fits "Vehicle Expenses", "Transportation", "Travel" or "Fuel" equally well. Only score LOW (below 0.5) when the receipt is clearly a DIFFERENT kind of expense (e.g. a restaurant bill filed under "Utilities").
- confidence: a number 0 to 1 for how confident you are you read this receipt reliably.

If the image is not a readable receipt, use nulls, categoryFits 0, and a low confidence.`;

	const p = await geminiJson(dataUrl, prompt);
	if (!p) return empty;
	return {
		ocrAmount: parseAmount(p.amount),
		ocrDate: normalizeDate(p.date),
		ocrCurrency: parseCurrency(p.currency),
		ocrCategoryGuess:
			typeof p.categoryGuess === "string" && p.categoryGuess.trim()
				? p.categoryGuess.trim().slice(0, 80)
				: null,
		categoryFits: clamp01(p.categoryFits, 0),
		overallConfidence: clamp01(p.confidence, 0.5),
	};
}
