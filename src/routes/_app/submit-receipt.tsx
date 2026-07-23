import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck, Upload } from "lucide-react";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { ReceiptPreview } from "#/components/receipts/ReceiptPreview";
import {
	Button,
	Card,
	Field,
	Input,
	Select,
	Textarea,
} from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { branchById, primaryCategories, subCategories } from "#/lib/calc";
import {
	availableCurrencies,
	rateForCurrency,
	toUsd,
} from "#/lib/currency/exchangeRate";
import { formatMoney, todayIso } from "#/lib/format";
import { useStore } from "#/lib/store/store";
import type { CurrencyCode } from "#/lib/types";

export const Route = createFileRoute("/_app/submit-receipt")({
	component: SubmitReceiptPage,
});

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

function SubmitReceiptPage() {
	const { user } = useAuth();
	const { data, addExpense, verifyExpense } = useStore();
	const navigate = useNavigate();

	const branch = branchById(data.branches, user?.branchId ?? null);

	const [fileName, setFileName] = useState<string | null>(null);
	const [dataUrl, setDataUrl] = useState<string | null>(null);

	// Manual entry — the branch types everything; OCR verifies it after submit.
	const [description, setDescription] = useState("");
	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState<CurrencyCode>(
		branch?.localCurrency ?? "USD",
	);
	const [expenseDate, setExpenseDate] = useState(todayIso());
	const [categoryId, setCategoryId] = useState("");
	const [subId, setSubId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);

	if (!branch) return null;

	const activePrimary = primaryCategories(data.categories, true);
	const subs = subCategories(data.categories, categoryId, true);
	const requiresSub = subs.length > 0; // Only "Other" carries sub-categories.

	async function handleFile(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setFileName(file.name);
		setError(null);
		setDataUrl(await fileToDataUrl(file));
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!branch) return;
		const amt = Number(amount);
		if (!description.trim()) return setError("Description is required.");
		if (!Number.isFinite(amt) || amt <= 0)
			return setError("Enter a valid amount greater than 0.");
		if (!expenseDate) return setError("Expense date is required.");
		if (!categoryId) return setError("Select a category.");
		if (requiresSub && !subId)
			return setError('A sub-category is required when "Other" is selected.');
		if (!dataUrl)
			return setError("Upload the receipt image before submitting.");

		// Own currency uses the branch's rate; another branch's currency uses that
		// branch's rate (never a silent 1.0).
		const rate =
			currency === branch.localCurrency
				? branch.exchangeRateToUsd
				: rateForCurrency(currency, data.branches);

		setSubmitting(true);
		try {
			const id = await addExpense({
				branchId: branch.id,
				submittedByUserId: user?.id ?? "",
				description: description.trim(),
				expenseDate,
				localAmount: Math.round(amt * 100) / 100,
				localCurrency: currency,
				exchangeRateToUsd: rate,
				usdAmount: toUsd(amt, rate),
				categoryId,
				otherSubcategoryId: requiresSub ? subId : null,
				receiptFileName: fileName,
				receiptDataUrl: dataUrl,
				ocrConfidence: null,
			});
			// Fire the background verification — don't block the success screen.
			// If the tab closes before it lands, HQ/branch can Re-check later.
			void verifyExpense(id);
			setSubmitted(true);
		} catch {
			setError("Could not submit. Please try again.");
		} finally {
			setSubmitting(false);
		}
	}

	function resetForm() {
		setFileName(null);
		setDataUrl(null);
		setDescription("");
		setAmount("");
		setCurrency(branch?.localCurrency ?? "USD");
		setExpenseDate(todayIso());
		setCategoryId("");
		setSubId("");
		setError(null);
		setSubmitted(false);
	}

	const localPreview = formatMoney(
		amount && Number(amount) > 0 ? Number(amount) : 0,
		currency,
	);

	if (submitted) {
		return (
			<Card className="mx-auto max-w-lg p-8 text-center">
				<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e4f4ea] text-[var(--color-positive)]">
					<CheckCircle2 size={26} />
				</div>
				<h2 className="text-xl font-bold">Expense submitted</h2>
				<p className="mt-2 text-sm text-[var(--color-muted)]">
					{description} · {localPreview} was added to {branch.name}. It's being
					verified against the receipt — if anything doesn't match, HQ will
					review it.
				</p>
				<div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
					<Button onClick={() => navigate({ to: "/expenses" })}>
						View my receipts
					</Button>
					<Button variant="ghost" onClick={resetForm}>
						Submit another
					</Button>
				</div>
			</Card>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
			{/* Upload */}
			<div className="space-y-5">
				<Card className="p-5">
					<h3 className="text-base font-semibold">1 · Upload receipt</h3>
					<p className="mt-1 text-sm text-[var(--color-muted)]">
						JPG, PNG, HEIF or PDF. Enter the details yourself on the right — the
						receipt is checked against them after you submit.
					</p>

					<label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-forest-200)] bg-[var(--color-forest-50)] px-6 py-10 text-center transition-colors hover:border-[var(--color-forest-400)]">
						<Upload size={26} className="text-[var(--color-forest-500)]" />
						<span className="text-sm font-medium text-[var(--color-forest-800)]">
							{fileName
								? "Choose a different file"
								: "Click to upload a receipt"}
						</span>
						<span className="text-xs text-[var(--color-muted)]">
							Required — kept with the transaction for verification
						</span>
						<input
							type="file"
							accept="image/*,.heic,.heif,application/pdf"
							className="hidden"
							onChange={handleFile}
						/>
					</label>

					{dataUrl && (
						<div className="mt-4">
							<ReceiptPreview
								dataUrl={dataUrl}
								fileName={fileName}
								height={200}
							/>
						</div>
					)}
				</Card>

				<Card className="flex items-start gap-3 p-4 text-sm text-[var(--color-muted)]">
					<ShieldCheck
						size={18}
						className="mt-0.5 shrink-0 text-[var(--color-forest-600)]"
					/>
					<span>
						After you submit, we compare the receipt's amount, date and category
						with what you entered. A mismatch is flagged for HQ — it doesn't
						block your submission.
					</span>
				</Card>
			</div>

			{/* Manual entry form */}
			<Card className="p-5">
				<h3 className="text-base font-semibold">2 · Enter the details</h3>
				<p className="mt-1 text-sm text-[var(--color-muted)]">
					Type the transaction exactly as it appears on the receipt.
				</p>

				<form onSubmit={handleSubmit} className="mt-4 space-y-4">
					<Field label="Description" required hint="What was this expense for?">
						<Textarea
							rows={2}
							placeholder="e.g. Sunday service refreshments"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</Field>

					<div className="grid grid-cols-2 gap-3">
						<Field label="Amount" required>
							<Input
								type="number"
								min="0"
								step="0.01"
								placeholder="0.00"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
							/>
						</Field>
						<Field label="Currency" required>
							<Select
								value={currency}
								onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
							>
								{availableCurrencies(branch.localCurrency, data.branches).map(
									(c) => (
										<option key={c} value={c}>
											{c}
											{c === branch.localCurrency ? " (branch)" : ""}
										</option>
									),
								)}
							</Select>
						</Field>
					</div>

					<Field label="Expense date" required>
						<Input
							type="date"
							value={expenseDate}
							onChange={(e) => setExpenseDate(e.target.value)}
						/>
					</Field>

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
						<Field
							label="Sub-category"
							required
							hint='Required because "Other" is selected.'
						>
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

					<Button type="submit" className="w-full" disabled={submitting}>
						{submitting ? "Submitting…" : "Submit expense"}
					</Button>
				</form>
			</Card>
		</div>
	);
}
