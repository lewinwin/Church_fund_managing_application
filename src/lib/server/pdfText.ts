// Digital-PDF text extraction — pulls the text layer out of a born-digital PDF
// receipt (emailed invoices, software-generated receipts). No OCR and no network:
// unpdf bundles a serverless build of pdf.js. Scanned / image-only PDFs have no
// text layer and yield null, so the caller routes them to human review. The
// extracted text is fed to the same parser (receiptParse.ts) as OCR text.
import { extractText, getDocumentProxy } from "unpdf";

/** Extract the text layer from a PDF data URL. Returns the text, or null when the
 *  input isn't a PDF or has no usable text layer (e.g. a scanned image PDF).
 *  Never throws. */
export async function extractPdfText(dataUrl: string): Promise<string | null> {
	const m = /^data:application\/pdf;base64,(.*)$/s.exec(dataUrl);
	if (!m) return null;
	try {
		const bytes = new Uint8Array(Buffer.from(m[1], "base64"));
		const doc = await getDocumentProxy(bytes);
		const { text } = await extractText(doc, { mergePages: true });
		const merged = (Array.isArray(text) ? text.join("\n") : text).trim();
		return merged.length ? merged : null;
	} catch (err) {
		console.error("PDF text extraction failed", err);
		return null;
	}
}
