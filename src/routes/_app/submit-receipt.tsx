import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	CheckCircle2,
	Loader2,
	ScanLine,
	Sparkles,
	Upload,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useState } from "react";
import { ReceiptPreview } from "#/components/receipts/ReceiptPreview";
import {
	Button,
	Card,
	Field,
	Input,
	Select,
	StatusPill,
} from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { branchById, primaryCategories, subCategories } from "#/lib/calc";
import { rateToUsd, toUsd } from "#/lib/currency/exchangeRate";
import { formatUsd, todayIso } from "#/lib/format";
import { extractReceiptData } from "#/lib/ocr/ocrService";
import { useStore } from "#/lib/store/store";
import type { CurrencyCode } from "#/lib/types";

export const Route = createFileRoute("/_app/submit-receipt")({
	component: SubmitReceiptPage,
});

type OcrStatus = "idle" | "processing" | "done" | "failed";

const CURRENCIES: CurrencyCode[] = ["SGD", "MWK", "ZAR", "CRC", "USD"];

function SubmitReceiptPage() {
	const { user } = useAuth();
	const { data, addExpense } = useStore();
	const navigate = useNavigate();

	const branch = branchById(data.branches, user?.branchId ?? null);

	const [fileName, setFileName] = useState<string | null>(null);
	const [dataUrl, setDataUrl] = useState<string | null>(null);
	const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
	const [simulateFailure, setSimulateFailure] = useState(false);
	const [confidence, setConfidence] = useState<number | null>(null);

	// Editable review form (source of truth).
	const [merchant, setMerchant] = useState("");
	const [amount, setAmount] = useState("");
	const [currency, setCurrency] = useState<CurrencyCode>(
		branch?.localCurrency ?? "USD",
	);
	const [expenseDate, setExpenseDate] = useState(todayIso());
	const [categoryId, setCategoryId] = useState("");
	const [subId, setSubId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);

	if (!branch) return null;

	const activePrimary = primaryCategories(data.categories, true);
	const subs = subCategories(data.categories, categoryId, true);
	const requiresSub = subs.length > 0; // Only "Other" carries sub-categories.

	async function handleFile(e: ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file || !branch) return;
		setFileName(file.name);
		setError(null);

		const reader = new FileReader();
		reader.onload = () => setDataUrl(reader.result as string);
		reader.readAsDataURL(file);

		setOcrStatus("processing");
		const result = await extractReceiptData(file, {
			currency: branch.localCurrency,
			simulateFailure,
		});

		if (result.amount == null && result.merchantName == null) {
			// OCR failed / low confidence — leave fields empty for manual entry.
			setOcrStatus("failed");
			setConfidence(result.confidence ?? null);
			setCurrency(branch.localCurrency);
			return;
		}

		setOcrStatus("done");
		setConfidence(result.confidence ?? null);
		setMerchant(result.merchantName ?? "");
		setAmount(result.amount != null ? String(result.amount) : "");
		setCurrency(result.currency ?? branch.localCurrency);
		if (result.date) setExpenseDate(result.date);
	}

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!branch) return;
		const amt = Number(amount);
		if (!merchant.trim()) return setError("Merchant name is required.");
		if (!Number.isFinite(amt) || amt <= 0)
			return setError("Enter a valid amount greater than 0.");
		if (!expenseDate) return setError("Expense date is required.");
		if (!categoryId) return setError("Select a category.");
		if (requiresSub && !subId)
			return setError('A sub-category is required when "Other" is selected.');

		const rate = rateToUsd(currency);
		addExpense({
			branchId: branch.id,
			submittedByUserId: user?.id ?? "",
			merchantName: merchant.trim(),
			expenseDate,
			localAmount: Math.round(amt * 100) / 100,
			localCurrency: currency,
			exchangeRateToUsd: rate,
			usdAmount: toUsd(amt, currency),
			categoryId,
			otherSubcategoryId: requiresSub ? subId : null,
			receiptFileName: fileName,
			receiptDataUrl: dataUrl,
			ocrConfidence: confidence,
			ocrRaw: null,
		});
		setSubmitted(true);
	}

	function resetForm() {
		setFileName(null);
		setDataUrl(null);
		setOcrStatus("idle");
		setConfidence(null);
		setMerchant("");
		setAmount("");
		setCurrency(branch?.localCurrency ?? "USD");
		setExpenseDate(todayIso());
		setCategoryId("");
		setSubId("");
		setError(null);
		setSubmitted(false);
	}

	const usdPreview =
		amount && Number(amount) > 0 ? toUsd(Number(amount), currency) : 0;

	if (submitted) {
		return (
			<Card className="mx-auto max-w-lg p-8 text-center">
				<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e4f4ea] text-[var(--color-positive)]">
					<CheckCircle2 size={26} />
				</div>
				<h2 className="text-xl font-bold">Expense submitted</h2>
				<p className="mt-2 text-sm text-[var(--color-muted)]">
					{merchant} · {formatUsd(usdPreview)} was added to {branch.name}. Your
					dashboard and receipts list have been updated.
				</p>
				<div className="mt-6 flex justify-center gap-2">
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
			{/* Upload + OCR state */}
			<div className="space-y-5">
				<Card className="p-5">
					<h3 className="text-base font-semibold">1 · Upload receipt</h3>
					<p className="mt-1 text-sm text-[var(--color-muted)]">
						JPG, PNG, HEIF or PDF. OCR will try to read the details — you can
						correct anything.
					</p>

					<label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-forest-200)] bg-[var(--color-forest-50)] px-6 py-10 text-center transition-colors hover:border-[var(--color-forest-400)]">
						<Upload size={26} className="text-[var(--color-forest-500)]" />
						<span className="text-sm font-medium text-[var(--color-forest-800)]">
							{fileName
								? "Choose a different file"
								: "Click to upload a receipt"}
						</span>
						<span className="text-xs text-[var(--color-muted)]">
							Held in your browser only (no server upload in W1)
						</span>
						<input
							type="file"
							accept="image/*,.heic,.heif,application/pdf"
							className="hidden"
							onChange={handleFile}
						/>
					</label>

					<label className="mt-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
						<input
							type="checkbox"
							checked={simulateFailure}
							onChange={(e) => setSimulateFailure(e.target.checked)}
							className="accent-[var(--color-forest-700)]"
						/>
						Simulate OCR failure (test manual entry fallback)
					</label>
				</Card>

				{ocrStatus !== "idle" && (
					<Card className="p-5">
						<div className="mb-3 flex items-center justify-between">
							<h3 className="text-base font-semibold">OCR status</h3>
							{ocrStatus === "processing" && (
								<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-forest-600)]">
									<Loader2 size={14} className="animate-spin" /> Reading…
								</span>
							)}
							{ocrStatus === "done" && <StatusPill status="healthy" />}
							{ocrStatus === "failed" && (
								<span className="rounded-full bg-[#fbf1dd] px-2.5 py-1 text-xs font-semibold text-[#b7841f]">
									Low confidence
								</span>
							)}
						</div>

						{ocrStatus === "processing" && (
							<div className="flex items-center gap-3 rounded-xl bg-[var(--color-forest-50)] px-4 py-5 text-[var(--color-forest-700)]">
								<ScanLine size={20} className="animate-pulse" />
								<span className="text-sm">
									Extracting amount, currency, date and merchant…
								</span>
							</div>
						)}
						{ocrStatus === "done" && (
							<p className="flex items-center gap-2 text-sm text-[var(--color-positive)]">
								<Sparkles size={16} /> Fields pre-filled
								{confidence != null &&
									` at ${Math.round(confidence * 100)}% confidence`}
								. Review them on the right.
							</p>
						)}
						{ocrStatus === "failed" && (
							<p className="text-sm text-[var(--color-muted)]">
								OCR couldn't read this receipt. No problem — enter the details
								manually on the right. Submission is never blocked by OCR.
							</p>
						)}

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
				)}
			</div>

			{/* Review form */}
			<Card className="p-5">
				<h3 className="text-base font-semibold">2 · Review & confirm</h3>
				<p className="mt-1 text-sm text-[var(--color-muted)]">
					Your corrections are final — OCR output is only a suggestion.
				</p>

				<form onSubmit={handleSubmit} className="mt-4 space-y-4">
					<Field label="Merchant name" required>
						<Input
							placeholder="e.g. FairPrice"
							value={merchant}
							onChange={(e) => setMerchant(e.target.value)}
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
								{CURRENCIES.map((c) => (
									<option key={c} value={c}>
										{c}
										{c === branch.localCurrency ? " (branch)" : ""}
									</option>
								))}
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

					<div className="flex items-center justify-between rounded-xl bg-[var(--color-forest-50)] px-4 py-3">
						<span className="text-sm text-[var(--color-muted)]">
							USD equivalent (at entry)
						</span>
						<span className="text-lg font-bold">{formatUsd(usdPreview)}</span>
					</div>

					{error && (
						<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
							{error}
						</p>
					)}

					<Button type="submit" className="w-full">
						Submit expense
					</Button>
				</form>
			</Card>
		</div>
	);
}
