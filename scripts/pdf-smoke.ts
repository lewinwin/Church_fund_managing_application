// Smoke check for digital-PDF text extraction. Prints the text layer of a PDF,
// fully offline. Defaults to the committed sample receipt.
//
//   bun scripts/pdf-smoke.ts [pdfPath]
import { readFile } from "node:fs/promises";
import process from "node:process";
import { extractPdfText } from "../src/lib/server/pdfText";

const pdfPath = process.argv[2] ?? "scripts/fixtures/sample-receipt.pdf";
const buf = await readFile(pdfPath);
const dataUrl = `data:application/pdf;base64,${buf.toString("base64")}`;

const text = await extractPdfText(dataUrl);
console.log("=== PDF TEXT ===");
console.log(text ?? "(no text layer — scanned PDF, would route to review)");
process.exit(0);
