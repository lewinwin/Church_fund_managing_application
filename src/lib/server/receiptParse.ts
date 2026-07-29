// Pure receipt-text parsing: turn the raw text Tesseract reads off a receipt
// into a total amount and a date. No I/O, no OCR engine — just string logic, so
// it's directly unit-testable (receiptParse.test.ts). This is the "understanding"
// layer Tesseract itself can't do: OCR gives characters, this finds meaning.
//
// It answers only "what amount / what date"; whether that matches what the branch
// typed is decided later by compareReceipt (verify.ts).

export interface ParsedReceipt {
	amount: number | null;
	date: string | null;
	/** True when the amount came from a labelled "total" line (higher trust) vs.
	 *  the largest-value fallback (lower trust). Feeds the OCR confidence. */
	amountLabeled: boolean;
}

// A money token: either grouped thousands (1,234 / 1.234 / 1 000) optionally with
// a 1-2 digit decimal, or a plain integer optionally with a 1-2 digit decimal.
const MONEY_RE = /\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;

// Lines that state a payable total. `subtotal` is deliberately excluded so we
// never mistake the pre-tax subtotal for the amount actually paid.
const TOTAL_RE = /total|amount\s+due|balance\s+due|amount\s+paid/i;
const SUBTOTAL_RE = /sub[\s-]*total/i;

/** Normalise one money token to a number, coping with the decimal/thousands
 *  conventions receipts mix (`1,234.56`, `1.234,56`, `498,72`, `1 000,00`).
 *  Returns null for anything that isn't a positive amount. */
export function parseMoney(token: string): number | null {
	const cleaned = token.replace(/[^\d.,]/g, ""); // drop currency symbols, spaces
	if (!/\d/.test(cleaned)) return null;

	const hasComma = cleaned.includes(",");
	const hasDot = cleaned.includes(".");
	let normalized: string;

	if (hasComma && hasDot) {
		// The rightmost separator is the decimal point; the other is thousands.
		const decimalSep =
			cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
		const thousandsSep = decimalSep === "," ? "." : ",";
		normalized = cleaned.split(thousandsSep).join("").replace(decimalSep, ".");
	} else if (hasComma || hasDot) {
		const sep = hasComma ? "," : ".";
		const parts = cleaned.split(sep);
		const decimals = parts[parts.length - 1];
		// A single separator with 1-2 trailing digits is a decimal point; anything
		// else (multiple separators, or 3 trailing digits) is thousands grouping.
		normalized =
			parts.length === 2 && decimals.length <= 2
				? `${parts[0]}.${decimals}`
				: parts.join("");
	} else {
		normalized = cleaned;
	}

	const n = Number.parseFloat(normalized);
	if (!Number.isFinite(n) || n <= 0) return null;
	return Math.round(n * 100) / 100;
}

/** Best amount from a set of raw money tokens: prefer tokens that carry a decimal
 *  (real prices) over bare integers (which are often years, quantities or counts),
 *  then take the largest — the total is the biggest line on a receipt. */
function bestAmount(raws: string[]): number | null {
	const withDecimals: number[] = [];
	const integers: number[] = [];
	for (const raw of raws) {
		const v = parseMoney(raw);
		if (v == null) continue;
		(/[.,]\d{1,2}$/.test(raw.trim()) ? withDecimals : integers).push(v);
	}
	const pool = withDecimals.length ? withDecimals : integers;
	return pool.length ? Math.max(...pool) : null;
}

const MONTHS: Record<string, number> = {
	jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
	jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
	if (m < 1 || m > 12 || d < 1 || d > 31) return null;
	return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Find a purchase date in the text and normalise to YYYY-MM-DD. Tries ISO,
 *  numeric (day-first, the regional default — swaps only when the first field
 *  can't be a day), and month-name formats. Returns null if none found. */
export function parseReceiptDate(text: string): string | null {
	// ISO — unambiguous, try first.
	let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(text);
	if (m) {
		const r = iso(+m[1], +m[2], +m[3]);
		if (r) return r;
	}

	// Numeric DD/MM/YYYY (or . / - separators), 4-digit year.
	m = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/.exec(text);
	if (m) {
		let d = +m[1];
		let mo = +m[2];
		// Day-first by default; swap only when the input is clearly month-first.
		if (mo > 12 && d <= 12) [d, mo] = [mo, d];
		const r = iso(+m[3], mo, d);
		if (r) return r;
	}

	// DD Mon YYYY  (e.g. 11 Mar 2026).
	m = /\b(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})\b/.exec(text);
	if (m) {
		const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
		if (mo) {
			const r = iso(+m[3], mo, +m[1]);
			if (r) return r;
		}
	}

	// Mon DD, YYYY  (e.g. Mar 11, 2026).
	m = /\b([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(text);
	if (m) {
		const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
		if (mo) {
			const r = iso(+m[3], mo, +m[2]);
			if (r) return r;
		}
	}

	return null;
}

/** Extract the total amount and the date from raw OCR receipt text. Prefers a
 *  labelled total line; otherwise falls back to the largest priced value. */
export function parseReceiptFields(text: string): ParsedReceipt {
	const totalRaws: string[] = [];
	for (const line of text.split(/\r?\n/)) {
		if (!TOTAL_RE.test(line) || SUBTOTAL_RE.test(line)) continue;
		const found = line.match(MONEY_RE);
		if (found) totalRaws.push(...found);
	}

	let amount = bestAmount(totalRaws);
	const amountLabeled = amount != null;
	if (amount == null) amount = bestAmount(text.match(MONEY_RE) ?? []);

	return { amount, date: parseReceiptDate(text), amountLabeled };
}
