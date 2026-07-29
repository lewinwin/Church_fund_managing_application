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
import path from "node:path";
import process from "node:process";
import { createWorker } from "tesseract.js";
import type { CurrencyCode } from "#/lib/types";
import { parseReceiptFields } from "./receiptParse";

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

// --- Local OCR (Tesseract) -------------------------------------------------
// Verification runs entirely on the server via Tesseract with bundled English
// data — no API key, no network. Tesseract yields raw text; the pure parser
// (receiptParse.ts) extracts the amount + date. There is no semantic model, so
// the category check is neutralised (categoryFits = 1) and HQ judges category
// manually. See ARCHITECTURE.md.

const TESSDATA_PATH = path.resolve(process.cwd(), "tessdata");

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;
let workerPromise: Promise<OcrWorker> | null = null;

/** One shared, lazily-created worker: loading the 4 MB language data per request
 *  would be far too slow. Tesseract queues jobs internally, so concurrent
 *  verifications are serialised safely. */
function getOcrWorker(): Promise<OcrWorker> {
	if (!workerPromise) {
		workerPromise = createWorker("eng", 1, {
			langPath: TESSDATA_PATH,
			gzip: false, // bundled traineddata is not gzipped
			cacheMethod: "none", // already bundled; don't write a cache copy to cwd
		});
	}
	return workerPromise;
}

/** Decode an image data URL to a Buffer. Returns null for non-images (e.g. a
 *  PDF receipt) — Tesseract reads images only, so those route to human review. */
function base64Image(dataUrl: string): Buffer | null {
	const m = /^data:(image\/[a-z.+-]+);base64,(.*)$/s.exec(dataUrl);
	if (!m) return null;
	return Buffer.from(m[2], "base64");
}

/** Read a receipt image with Tesseract → raw text + 0..1 confidence, or null
 *  when the input isn't a readable image. Never throws. */
async function ocrReceiptImage(
	dataUrl: string,
): Promise<{ text: string; confidence: number } | null> {
	const img = base64Image(dataUrl);
	if (!img) return null;
	try {
		const worker = await getOcrWorker();
		const { data } = await worker.recognize(img);
		return { text: data.text, confidence: clamp01(data.confidence / 100, 0) };
	} catch (err) {
		console.error("Tesseract OCR failed", err);
		return null;
	}
}

/** Verify a submitted expense against its receipt. Reads the receipt locally
 *  with Tesseract and extracts amount + date; the category is neutralised (no
 *  semantic model — HQ decides it). `ctx` is unused on this build but kept so the
 *  caller is unchanged. Never throws — on failure returns a null/zero-confidence
 *  result so the caller routes the transaction to `need_check`. */
export async function runReceiptVerification(
	dataUrl: string,
	_ctx: {
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
		categoryFits: 1, // no semantic model → category never auto-flags
		overallConfidence: 0,
	};

	const read = await ocrReceiptImage(dataUrl);
	if (!read) return empty;

	const fields = parseReceiptFields(read.text);
	// A fallback (unlabelled) amount is less trustworthy — damp its confidence so
	// a shaky guess is more likely to be routed to a human.
	const confidence = fields.amountLabeled
		? read.confidence
		: read.confidence * 0.6;

	return {
		ocrAmount: fields.amount,
		ocrDate: fields.date,
		ocrCurrency: null, // not inferred locally; compareReceipt doesn't use it
		ocrCategoryGuess: null,
		categoryFits: 1, // HQ decides category manually on this build
		overallConfidence: fields.amount == null ? 0 : confidence,
	};
}
