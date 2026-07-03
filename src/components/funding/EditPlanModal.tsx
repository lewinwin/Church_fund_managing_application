import { type FormEvent, useEffect, useState } from "react";
import { Modal } from "#/components/ui/Overlay";
import {
	Button,
	Field,
	Input,
	Select,
	Textarea,
} from "#/components/ui/primitives";
import { activePlanForBranch, branchById } from "#/lib/calc";
import { formatUsd } from "#/lib/format";
import { useStore } from "#/lib/store/store";
import type { FundingPlan, FundingPlanStatus } from "#/lib/types";

// Edit an existing funding plan — adjust target, description, and status.
// Closing (or cancelling) an active plan frees the branch so HQ can create a
// new plan for it, which is what completes the funding-plan lifecycle.
export function EditPlanModal({
	open,
	onClose,
	plan,
}: {
	open: boolean;
	onClose: () => void;
	plan: FundingPlan | null;
}) {
	const { data, updateFundingPlan } = useStore();

	const [target, setTarget] = useState("");
	const [description, setDescription] = useState("");
	const [status, setStatus] = useState<FundingPlanStatus>("active");
	const [error, setError] = useState<string | null>(null);

	// Re-seed the form whenever a different plan is opened.
	useEffect(() => {
		if (plan) {
			setTarget(String(plan.totalTargetUsd));
			setDescription(plan.description);
			setStatus(plan.status);
			setError(null);
		}
	}, [plan]);

	if (!plan) return null;

	const branchName = branchById(data.branches, plan.branchId)?.name ?? "Branch";

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!plan) return;
		const amt = Number(target);
		if (!Number.isFinite(amt) || amt <= 0) {
			setError("Enter a valid target amount.");
			return;
		}
		// One active plan per branch: block re-activating if another is active.
		if (status === "active") {
			const otherActive = activePlanForBranch(data, plan.branchId);
			if (otherActive && otherActive.id !== plan.id) {
				setError(
					`${branchName} already has another active plan. Close it first.`,
				);
				return;
			}
		}
		updateFundingPlan(plan.id, {
			totalTargetUsd: Math.round(amt * 100) / 100,
			description: description.trim() || "Branch funding plan",
			status,
		});
		onClose();
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={`Manage plan · ${branchName}`}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="edit-plan-form">
						Save changes
					</Button>
				</>
			}
		>
			<form id="edit-plan-form" onSubmit={handleSubmit} className="space-y-4">
				<Field label="Total target (USD)" required>
					<Input
						type="number"
						min="0"
						step="0.01"
						placeholder="0.00"
						value={target}
						onChange={(e) => setTarget(e.target.value)}
					/>
				</Field>
				<Field label="Description">
					<Textarea
						rows={2}
						placeholder="What is this fund for?"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</Field>
				<Field
					label="Status"
					hint="Closing or cancelling frees this branch so you can start a new plan for it."
				>
					<Select
						value={status}
						onChange={(e) => setStatus(e.target.value as FundingPlanStatus)}
					>
						<option value="active">Active</option>
						<option value="closed">Closed</option>
						<option value="cancelled">Cancelled</option>
					</Select>
				</Field>
				{error && (
					<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
						{error}
					</p>
				)}
				<p className="rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
					Target so far: {formatUsd(plan.totalTargetUsd)}. Editing the target
					does not change money already released or spent — those are recorded
					separately.
				</p>
			</form>
		</Modal>
	);
}
