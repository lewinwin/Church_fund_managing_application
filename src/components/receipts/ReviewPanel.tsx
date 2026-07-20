// The OCR verification panel: entered-vs-receipt comparison plus HQ's decision
// buttons. Shared by the "Needs Check" queue card and the transaction detail
// drawer, so HQ can decide either from the list or while looking at the receipt.
import { Check, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { Button, Textarea } from "#/components/ui/primitives";
import { categoryLabel } from "#/lib/calc";
import { formatDate, formatMoney } from "#/lib/format";
import { useStore } from "#/lib/store/store";
import type { Category, CurrencyCode, Expense, JsonValue } from "#/lib/types";

interface OcrCheck {
	ocrAmount: number | null;
	ocrDate: string | null;
	ocrCategoryGuess: string | null;
	categoryFits: number;
	amountMatch: boolean;
	dateMatch: boolean;
	categoryOk: boolean;
}

export function readOcrCheck(raw: JsonValue | null): OcrCheck | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const o = raw as Record<string, JsonValue>;
	if (!("amountMatch" in o)) return null;
	return {
		ocrAmount: typeof o.ocrAmount === "number" ? o.ocrAmount : null,
		ocrDate: typeof o.ocrDate === "string" ? o.ocrDate : null,
		ocrCategoryGuess:
			typeof o.ocrCategoryGuess === "string" ? o.ocrCategoryGuess : null,
		categoryFits: typeof o.categoryFits === "number" ? o.categoryFits : 0,
		amountMatch: o.amountMatch === true,
		dateMatch: o.dateMatch === true,
		categoryOk: o.categoryOk === true,
	};
}

function CompareRow({
	label,
	entered,
	read,
	ok,
}: {
	label: string;
	entered: string;
	read: string;
	ok: boolean;
}) {
	return (
		<div className="grid grid-cols-[76px_1fr_1fr_auto] items-center gap-2 py-1 text-sm">
			<span className="text-[var(--color-muted)]">{label}</span>
			<span className="font-medium">{entered}</span>
			<span className={ok ? "" : "font-medium text-[var(--color-negative)]"}>
				{read}
			</span>
			{ok ? (
				<Check size={15} className="text-[var(--color-positive)]" />
			) : (
				<X size={15} className="text-[var(--color-negative)]" />
			)}
		</div>
	);
}

export function ReviewPanel({
	expense,
	categories,
	currency,
}: {
	expense: Expense;
	categories: Category[];
	currency: CurrencyCode;
}) {
	const { cancelExpense, requestModify, confirmModification, verifyExpense } =
		useStore();
	const [note, setNote] = useState("");
	const [busy, setBusy] = useState(false);

	const status = expense.reviewStatus;
	const check = readOcrCheck(expense.ocrRaw);
	const isFlagged = status === "need_check" || status === "after_modify_check";
	const catText = categoryLabel(
		categories,
		expense.categoryId,
		expense.otherSubcategoryId,
	);

	async function run(fn: () => Promise<void>) {
		setBusy(true);
		try {
			await fn();
		} finally {
			setBusy(false);
		}
	}

	return (
		<div>
			<div className="mb-2 flex items-center justify-between gap-3">
				<h4 className="text-sm font-semibold">OCR verification</h4>
				<Button
					variant="ghost"
					disabled={busy}
					onClick={() => run(() => verifyExpense(expense.id))}
					title="Re-run OCR verification"
				>
					<RotateCw size={15} /> Re-check
				</Button>
			</div>

			{check ? (
				<div className="rounded-lg bg-[var(--color-forest-50)] px-3 py-2">
					<div className="grid grid-cols-[76px_1fr_1fr_auto] gap-2 pb-1 text-xs font-semibold text-[var(--color-muted)]">
						<span />
						<span>Entered</span>
						<span>Receipt (OCR)</span>
						<span />
					</div>
					<CompareRow
						label="Amount"
						entered={formatMoney(expense.localAmount, currency)}
						read={
							check.ocrAmount != null
								? formatMoney(check.ocrAmount, currency)
								: "—"
						}
						ok={check.amountMatch}
					/>
					<CompareRow
						label="Date"
						entered={formatDate(expense.expenseDate)}
						read={check.ocrDate ? formatDate(check.ocrDate) : "—"}
						ok={check.dateMatch}
					/>
					<CompareRow
						label="Category"
						entered={catText}
						read={
							check.ocrCategoryGuess ??
							`fit ${Math.round(check.categoryFits * 100)}%`
						}
						ok={check.categoryOk}
					/>
				</div>
			) : (
				<p className="text-sm text-[var(--color-muted)]">
					{status === "checking"
						? "Verification pending — Re-check to run it now."
						: "No OCR comparison available."}
				</p>
			)}

			{expense.reviewNote && (
				<p className="mt-2 rounded-lg bg-[#e7eefb] px-3 py-2 text-sm text-[#2f5bb7]">
					<span className="font-semibold">HQ note:</span> {expense.reviewNote}
				</p>
			)}

			{isFlagged && (
				<div className="mt-3 space-y-2">
					<Textarea
						rows={2}
						placeholder="Optional note to the branch (e.g. wrong date, not a fundable category)…"
						value={note}
						onChange={(e) => setNote(e.target.value)}
					/>
					<div className="flex flex-wrap gap-2">
						<Button
							disabled={busy}
							onClick={() => run(() => confirmModification(expense.id))}
							title={
								status === "after_modify_check"
									? "Confirm the correction"
									: "Approve as-is (overrides the OCR flag)"
							}
						>
							<Check size={15} /> Correct
						</Button>
						<Button
							variant="accent"
							disabled={busy}
							onClick={() =>
								run(() => requestModify(expense.id, note.trim() || null))
							}
						>
							Modify
						</Button>
						<Button
							variant="danger"
							disabled={busy}
							onClick={() =>
								run(() => cancelExpense(expense.id, note.trim() || null))
							}
						>
							<X size={15} /> Cancel
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
