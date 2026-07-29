// PDF page rasterization — render each page of a PDF into a PNG image, so a
// scanned / image-only PDF (one with no text layer) can be OCR'd like a photo.
// Fully offline: unpdf renders via @napi-rs/canvas (a prebuilt native canvas —
// no compiler needed). Server-only (native module). The images are handed to the
// same Tesseract path as image receipts.
import { getDocumentProxy, renderPageAsImage } from "unpdf";

const canvasImport = () => import("@napi-rs/canvas");

// Don't rasterize an unbounded number of pages — a receipt is a handful at most.
const MAX_PAGES = 10;

/** Render each page of a PDF data URL to a PNG buffer at `scale`× resolution
 *  (higher = better OCR, slower). Returns [] for a non-PDF or on failure — the
 *  caller then routes to human review. Never throws. */
export async function renderPdfPages(
	dataUrl: string,
	scale = 2.5,
): Promise<Buffer[]> {
	const m = /^data:application\/pdf;base64,(.*)$/s.exec(dataUrl);
	if (!m) return [];
	try {
		const bytes = new Uint8Array(Buffer.from(m[1], "base64"));
		const doc = await getDocumentProxy(bytes);
		const count = Math.min(doc.numPages, MAX_PAGES);
		const pages: Buffer[] = [];
		for (let n = 1; n <= count; n++) {
			const png = await renderPageAsImage(doc, n, { canvasImport, scale });
			pages.push(Buffer.from(png));
		}
		return pages;
	} catch (err) {
		console.error("PDF render failed", err);
		return [];
	}
}
