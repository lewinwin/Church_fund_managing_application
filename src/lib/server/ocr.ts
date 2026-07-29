// Receipt reading — fully local, server-only. No API key and no network. Two
// sources feed one pipeline: image receipts are OCR'd with Tesseract (bundled
// English data), and digital PDFs have their text layer extracted directly
// (pdfText.ts — exact, no OCR). Either way the raw text goes to the pure parser
// (receiptParse.ts) which pulls out amount + date. There is no semantic model, so
// category is not auto-judged — HQ decides it. The caller (data.ts →
// compareReceipt) turns the result into a match/needs-check decision; this module
// never decides an outcome.
import path from "node:path";
import process from "node:process";
import { createWorker } from "tesseract.js";
import type { CurrencyCode } from "#/lib/types";
import { extractPdfText } from "./pdfText";
import { parseReceiptFields } from "./receiptParse";

export interface OcrVerification {
	ocrAmount: number | null;
	ocrDate: string | null; // YYYY-MM-DD
	ocrCurrency: CurrencyCode | null;
	/** Best-fit category name — always null on the local build (no semantic model). */
	ocrCategoryGuess: string | null;
	/** 0..1 fit to the chosen category — always 1 locally (category never flags). */
	categoryFits: number;
	/** 0..1 — overall confidence the receipt was read reliably. */
	overallConfidence: number;
}

function clamp01(v: number): number {
	return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

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
		return { text: data.text, confidence: clamp01(data.confidence / 100) };
	} catch (err) {
		console.error("Tesseract OCR failed", err);
		return null;
	}
}

/** Get the receipt's text + a 0..1 confidence from whichever source fits the
 *  input: a digital PDF's text layer (exact), or Tesseract OCR for images.
 *  Returns null when unreadable — a non-receipt, or a scanned PDF with no text
 *  layer, both of which should route to human review. */
async function readReceiptText(
	dataUrl: string,
): Promise<{ text: string; confidence: number } | null> {
	if (/^data:application\/pdf;base64,/.test(dataUrl)) {
		const text = await extractPdfText(dataUrl);
		// A digital PDF's text layer is exact → high confidence. No text layer
		// means a scanned/image-only PDF we can't read here → route to review.
		return text ? { text, confidence: 0.98 } : null;
	}
	return ocrReceiptImage(dataUrl);
}

/** Verify a submitted expense against its receipt. Reads it locally — a digital
 *  PDF via its text layer, or an image via Tesseract — and extracts amount +
 *  date; category is neutralised (categoryFits = 1) so it never auto-flags (HQ
 *  decides it). Never throws — on failure returns a null/zero-confidence result
 *  so the caller routes the transaction to `need_check`. */
export async function runReceiptVerification(
	dataUrl: string,
): Promise<OcrVerification> {
	const empty: OcrVerification = {
		ocrAmount: null,
		ocrDate: null,
		ocrCurrency: null,
		ocrCategoryGuess: null,
		categoryFits: 1, // no semantic model → category never auto-flags
		overallConfidence: 0,
	};

	const read = await readReceiptText(dataUrl);
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
