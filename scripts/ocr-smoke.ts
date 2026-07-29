// Smoke check for local Tesseract OCR. Loads the bundled English data (no CDN,
// no API key) and prints the text it reads from an image.
//
//   bun scripts/ocr-smoke.ts [imagePath]
//
// Defaults to the committed sample receipt. Proves the engine initializes and
// returns text fully offline.
import { readFile } from "node:fs/promises";
import process from "node:process";
import { createWorker } from "tesseract.js";

const imgPath = process.argv[2] ?? "scripts/fixtures/sample-receipt.png";

const worker = await createWorker("eng", 1, {
	langPath: "./tessdata", // local bundled traineddata
	gzip: false, // GitHub raw .traineddata is not gzipped
	cacheMethod: "none", // don't write a cache copy to cwd; we bundle it already
});

const buf = await readFile(imgPath);
const { data } = await worker.recognize(buf);

console.log("=== OCR TEXT ===");
console.log(data.text);
console.log("=== overall confidence:", data.confidence);

await worker.terminate();
process.exit(0);
