// Branch-side correction of a transaction HQ returned (Modify). Typed fields
// only — the receipt image stays fixed. On save it re-verifies against the
// receipt, which routes it to `after_modify_check` for HQ's second review.
//
// Rendered either beside the receipt drawer (so the receipt stays visible while
// correcting) or inside a modal from the "Returned to correct" list.
import { type FormEvent, useEffect, useState } from "react";
import {
	Button,
	Field,
	Input,
	Select,
	Textarea,
} from "#/components/ui/primitives";
import { primaryCategories, subCategories } from "#/lib/calc";
import { useStore } from "#/lib/store/store";
import type { Expense } from "#/lib/types";

export function EditExpenseForm({
	expense,
	onDone,
	onCancel,
}: {
	expense: Expense;
	/** Called after a successful resubmit. */
	onDone: () => void;
	onCancel: () => void;
}) {
	const { data, editExpense, verifyExpense } = useStore();

	const [description, setDescription] = useState(expense.description);
	const [amount, setAmount] = useState(String(expense.localAmount));
	const [expenseDate, setExpenseDate] = useState(expense.expenseDate);
	const [categoryId, setCategoryId] = useState(expense.categoryId);
	const [subId, setSubId] = useState(expense.otherSubcategoryId ?? "");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	// Re-seed if a different transaction is opened while the form is mounted.
	useEffect(() => {
		setDescription(expense.description);
		setAmount(String(expense.localAmount));
		setExpenseDate(expense.expenseDate);
		setCategoryId(expense.categoryId);
		setSubId(expense.otherSubcategoryId ?? "");
		setError(null);
	}, [expense]);

	const activePrimary = primaryCategories(data.categories, true);
	const subs = subCategories(data.categories, categoryId, true);
	const requiresSub = subs.length > 0;

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const amt = Number(amount);
		if (!description.trim()) return setError("Description is required.");
		if (!Number.isFinite(amt) || amt <= 0)
			return setError("Enter a valid amount greater than 0.");
		if (!expenseDate) return setError("Expense date is required.");
		if (!categoryId) return setError("Select a category.");
		if (requiresSub && !subId)
			return setError('A sub-category is required when "Other" is selected.');

		setBusy(true);
		try {
			await editExpense(expense.id, {
				localAmount: Math.round(amt * 100) / 100,
				expenseDate,
				categoryId,
				otherSubcategoryId: requiresSub ? subId : null,
				description: description.trim(),
			});
			void verifyExpense(expense.id);
			onDone();
		} catch {
			setError("Could not resubmit. Please try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{expense.reviewNote && (
				<p className="rounded-lg bg-[#e7eefb] px-3 py-2 text-sm text-[#2f5bb7]">
					<span className="font-semibold">HQ note:</span> {expense.reviewNote}
				</p>
			)}
			<p className="text-xs text-[var(--color-muted)]">
				The receipt stays as uploaded — correct the details to match it, in{" "}
				{expense.localCurrency}.
			</p>

			<Field label="Description" required>
				<Textarea
					rows={2}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</Field>
			<div className="grid grid-cols-2 gap-3">
				<Field label={`Amount (${expense.localCurrency})`} required>
					<Input
						type="number"
						min="0"
						step="0.01"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
					/>
				</Field>
				<Field label="Expense date" required>
					<Input
						type="date"
						value={expenseDate}
						onChange={(e) => setExpenseDate(e.target.value)}
					/>
				</Field>
			</div>
			<Field label="Category" required>
				<Select
					value={categoryId}
					onChange={(e) => {
						setCategoryId(e.target.value);
						setSubId("");
					}}
				>
					<option value="">Select a category…</option>
					{activePrimary.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</Select>
			</Field>
			{requiresSub && (
				<Field label="Sub-category" required>
					<Select value={subId} onChange={(e) => setSubId(e.target.value)}>
						<option value="">Select a sub-category…</option>
						{subs.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name}
							</option>
						))}
					</Select>
				</Field>
			)}
			{error && (
				<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
					{error}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<Button
					variant="ghost"
					type="button"
					onClick={onCancel}
					disabled={busy}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={busy}>
					{busy ? "Resubmitting…" : "Resubmit"}
				</Button>
			</div>
		</form>
	);
}
