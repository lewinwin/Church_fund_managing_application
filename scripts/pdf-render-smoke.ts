// Smoke check for PDF page rasterization. Renders each page of a PDF to a PNG
// and reports counts/sizes — fully offline. Defaults to the scanned fixture.
//
//   bun scripts/pdf-render-smoke.ts [pdfPath]
import { readFile } from "node:fs/promises";
import process from "node:process";
import { renderPdfPages } from "../src/lib/server/pdfRender";

const pdfPath = process.argv[2] ?? "scripts/fixtures/scanned-receipt.pdf";
const buf = await readFile(pdfPath);
const dataUrl = `data:application/pdf;base64,${buf.toString("base64")}`;

const pages = await renderPdfPages(dataUrl);
console.log(`rendered ${pages.length} page(s):`);
pages.forEach((p, i) =>
	console.log(`  page ${i + 1}: ${(p.length / 1024).toFixed(1)} KB PNG`),
);
process.exit(0);
