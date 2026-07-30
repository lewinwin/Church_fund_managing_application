// The OCR verification panel: entered-vs-receipt comparison plus HQ's decision
// buttons. Shared by the "Needs Check" queue card and the transaction detail
// drawer, so HQ can decide either from the list or while looking at the receipt.
import { Check, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { Button, Textarea } from "#/components/ui/primitives";
import { categoryLabel } from "#/lib/calc";
import { formatDate, formatMoney } from "#/lib/format";
import { availableActions } from "#/lib/reviewLifecycle";
import { useStore } from "#/lib/store/store";
import type { Category, CurrencyCode, Expense } from "#/lib/types";

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
		<div className="grid grid-cols-[52px_1fr_1fr_16px] items-start gap-x-2 gap-y-0.5 py-1.5 text-[13px] leading-tight sm:text-sm">
			<span className="text-[var(--color-muted)]">{label}</span>
			<span className="min-w-0 break-words font-medium tabular-nums">
				{entered}
			</span>
			<span
				className={`min-w-0 break-words tabular-nums ${
					ok ? "" : "font-medium text-[var(--color-negative)]"
				}`}
			>
				{read}
			</span>
			{ok ? (
				<Check size={15} className="mt-0.5 text-[var(--color-positive)]" />
			) : (
				<X size={15} className="mt-0.5 text-[var(--color-negative)]" />
			)}
		</div>
	);
}

export function ReviewPanel({
	expense,
	categories,
	currency,
	onResolved,
}: {
	expense: Expense;
	categories: Category[];
	currency: CurrencyCode;
	/** Called after a decision (Correct/Modify/Cancel) succeeds — NOT after
	 *  Re-check — so the container can close. HQ is done with the transaction
	 *  once a decision lands, and the parent's `selected` snapshot is stale. */
	onResolved?: () => void;
}) {
	const { cancelExpense, requestModify, confirmModification, verifyExpense } =
		useStore();
	const [note, setNote] = useState("");
	const [busy, setBusy] = useState(false);

	const status = expense.reviewStatus;
	const check = expense.ocrCheck;
	// Which decision buttons to show comes from the lifecycle, so the UI can never
	// offer an action the server would reject.
	const actions = availableActions(status, "hq_admin");
	const catText = categoryLabel(
		categories,
		expense.categoryId,
		expense.otherSubcategoryId,
	);

	// `resolve` marks a decision action: on success we notify the container to
	// close. Re-check passes false so the panel stays open for the next look.
	async function run(fn: () => Promise<void>, resolve = false) {
		setBusy(true);
		try {
			await fn();
			if (resolve) onResolved?.();
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
					<div className="grid grid-cols-[52px_1fr_1fr_16px] gap-x-2 pb-1 text-xs font-semibold leading-tight text-[var(--color-muted)]">
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

			{actions.length > 0 && (
				<div className="mt-3 space-y-2">
					<Textarea
						rows={2}
						placeholder="Optional note to the branch (e.g. wrong date, not a fundable category)…"
						value={note}
						onChange={(e) => setNote(e.target.value)}
					/>
					<div className="flex flex-wrap gap-2">
						{actions.includes("correct") && (
							<Button
								disabled={busy}
								onClick={() => run(() => confirmModification(expense.id), true)}
								title={
									status === "after_modify_check"
										? "Confirm the correction"
										: "Approve as-is (overrides the OCR flag)"
								}
							>
								<Check size={15} /> Correct
							</Button>
						)}
						{actions.includes("modify") && (
							<Button
								variant="accent"
								disabled={busy}
								onClick={() =>
									run(() => requestModify(expense.id, note.trim() || null), true)
								}
							>
								Modify
							</Button>
						)}
						{actions.includes("cancel") && (
							<Button
								variant="danger"
								disabled={busy}
								onClick={() =>
									run(() => cancelExpense(expense.id, note.trim() || null), true)
								}
							>
								<X size={15} /> Cancel
							</Button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
