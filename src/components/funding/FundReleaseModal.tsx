import { type FormEvent, useState } from "react";
import { Modal } from "#/components/ui/Overlay";
import {
	Button,
	Field,
	Input,
	Select,
	Textarea,
} from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { activePlanForBranch } from "#/lib/calc";
import { todayIso } from "#/lib/format";
import { useStore } from "#/lib/store/store";

// Record a manual fund release (a "top-up"). Increases the branch's released
// total and available balance. No real bank transfer — recorded in-system only.
export function FundReleaseModal({
	open,
	onClose,
	defaultBranchId,
}: {
	open: boolean;
	onClose: () => void;
	defaultBranchId?: string;
}) {
	const { data, addFundRelease } = useStore();
	const { user } = useAuth();

	const branchesWithPlan = data.branches.filter((b) =>
		activePlanForBranch(data, b.id),
	);

	const [branchId, setBranchId] = useState(
		defaultBranchId ?? branchesWithPlan[0]?.id ?? "",
	);
	const [amount, setAmount] = useState("");

	// Amount is entered and stored in the selected branch's local currency.
	const selectedBranch = data.branches.find((b) => b.id === branchId);
	const currency = selectedBranch?.localCurrency ?? "";
	const [releaseDate, setReleaseDate] = useState(todayIso());
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);

	function reset() {
		setAmount("");
		setNote("");
		setReleaseDate(todayIso());
		setError(null);
	}

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const amt = Number(amount);
		if (!branchId) {
			setError("Select a branch.");
			return;
		}
		if (!Number.isFinite(amt) || amt <= 0) {
			setError(`Enter a valid ${currency} amount.`);
			return;
		}
		const plan = activePlanForBranch(data, branchId);
		if (!plan) {
			setError("This branch has no active funding plan.");
			return;
		}
		addFundRelease({
			fundingPlanId: plan.id,
			branchId,
			amount: amt,
			releaseDate,
			note: note.trim() || null,
			createdByUserId: user?.id ?? "u-hq",
		});
		reset();
		onClose();
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Record fund release"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="fund-release-form">
						Record release
					</Button>
				</>
			}
		>
			<form
				id="fund-release-form"
				onSubmit={handleSubmit}
				className="space-y-4"
			>
				<Field label="Branch" required>
					<Select
						value={branchId}
						onChange={(e) => setBranchId(e.target.value)}
					>
						{branchesWithPlan.length === 0 && (
							<option value="">No active plans</option>
						)}
						{branchesWithPlan.map((b) => (
							<option key={b.id} value={b.id}>
								{b.name}
							</option>
						))}
					</Select>
				</Field>
				<Field label={`Amount (${currency})`} required>
					<Input
						type="number"
						min="0"
						step="0.01"
						placeholder="0.00"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
					/>
				</Field>
				<Field label="Release date" required>
					<Input
						type="date"
						value={releaseDate}
						onChange={(e) => setReleaseDate(e.target.value)}
					/>
				</Field>
				<Field label="Note" hint="Optional — e.g. which tranche or purpose.">
					<Textarea
						rows={2}
						placeholder="Add a note…"
						value={note}
						onChange={(e) => setNote(e.target.value)}
					/>
				</Field>
				{error && (
					<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
						{error}
					</p>
				)}
				<p className="rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
					Recording a release increases the branch's released total and
					available balance. It does not perform a real bank transfer.
				</p>
			</form>
		</Modal>
	);
}
