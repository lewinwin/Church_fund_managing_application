import { createFileRoute } from "@tanstack/react-router";
import { PlusCircle, Wallet } from "lucide-react";
import { type FormEvent, useState } from "react";
import { EditPlanModal } from "#/components/funding/EditPlanModal";
import { FundReleaseModal } from "#/components/funding/FundReleaseModal";
import { type Column, DataTable } from "#/components/ui/DataTable";
import { Modal } from "#/components/ui/Overlay";
import {
	Badge,
	Button,
	Field,
	Input,
	SectionCard,
	Select,
	Textarea,
} from "#/components/ui/primitives";
import { activePlanForBranch, branchFinancials } from "#/lib/calc";
import { toUsd, usdToLocal } from "#/lib/currency/exchangeRate";
import { formatMoney, formatPercent, formatUsd } from "#/lib/format";
import { useStore } from "#/lib/store/store";
import type { FundingPlan, FundingPlanStatus } from "#/lib/types";

export const Route = createFileRoute("/_app/funding-plans")({
	component: FundingPlansPage,
});

interface PlanRow {
	planId: string;
	branchId: string;
	branchName: string;
	localCurrency: string;
	rate: number;
	targetUsd: number;
	targetLocal: number;
	releasedUsd: number;
	spentUsd: number;
	availableUsd: number;
	remainingTargetUsd: number;
	percentUsed: number;
	status: FundingPlanStatus;
}

function statusTone(s: FundingPlanStatus) {
	return s === "active" ? "green" : s === "closed" ? "neutral" : "red";
}

function FundingPlansPage() {
	const { data, addFundingPlan } = useStore();
	const [createOpen, setCreateOpen] = useState(false);
	const [releaseOpen, setReleaseOpen] = useState(false);
	const [editPlan, setEditPlan] = useState<FundingPlan | null>(null);
	const [addTargetPlan, setAddTargetPlan] = useState<PlanRow | null>(null);

	const rows: PlanRow[] = data.fundingPlans.map((p) => {
		const fin = branchFinancials(data, p.branchId);
		const branch = data.branches.find((b) => b.id === p.branchId);
		const rate = branch?.exchangeRateToUsd ?? 1;
		return {
			planId: p.id,
			branchId: p.branchId,
			branchName: branch?.name ?? p.branchId,
			localCurrency: branch?.localCurrency ?? "USD",
			rate,
			targetUsd: p.totalTargetUsd,
			targetLocal: usdToLocal(p.totalTargetUsd, rate),
			releasedUsd: fin.releasedUsd,
			spentUsd: fin.spentUsd,
			availableUsd: fin.remainingUsd,
			remainingTargetUsd: Math.max(0, p.totalTargetUsd - fin.releasedUsd),
			percentUsed: fin.percentUsed,
			status: p.status,
		};
	});

	const columns: Column<PlanRow>[] = [
		{
			key: "branch",
			header: "Branch",
			render: (r) => (
				<span className="font-medium text-[var(--color-ink)]">
					{r.branchName}
				</span>
			),
		},
		{
			key: "target",
			header: "Target (local)",
			align: "right",
			render: (r) => formatMoney(r.targetLocal, r.localCurrency),
		},
		{
			key: "released",
			header: "Released",
			align: "right",
			render: (r) => formatUsd(r.releasedUsd),
		},
		{
			key: "spent",
			header: "Spent",
			align: "right",
			render: (r) => formatUsd(r.spentUsd),
		},
		{
			key: "available",
			header: "Available",
			align: "right",
			render: (r) => (
				<span className="font-semibold">{formatUsd(r.availableUsd)}</span>
			),
		},
		{
			key: "remainingTarget",
			header: "Left to release",
			align: "right",
			render: (r) => formatUsd(r.remainingTargetUsd),
		},
		{
			key: "used",
			header: "% used",
			align: "right",
			render: (r) => formatPercent(r.percentUsed),
		},
		{
			key: "status",
			header: "Status",
			render: (r) => (
				<Badge tone={statusTone(r.status)}>
					{r.status[0]?.toUpperCase()}
					{r.status.slice(1)}
				</Badge>
			),
		},
		{
			key: "action",
			header: "",
			align: "right",
			render: (r) => (
				<div className="flex justify-end gap-1">
					{r.status === "active" && (
						<Button variant="ghost" onClick={() => setAddTargetPlan(r)}>
							<PlusCircle size={14} /> Add
						</Button>
					)}
					<Button
						variant="ghost"
						onClick={() =>
							setEditPlan(
								data.fundingPlans.find((p) => p.id === r.planId) ?? null,
							)
						}
					>
						Manage
					</Button>
				</div>
			),
		},
	];

	return (
		<div className="space-y-5">
			<SectionCard
				title="Funding plans"
				action={
					<div className="flex flex-wrap justify-end gap-2">
						<Button variant="ghost" onClick={() => setReleaseOpen(true)}>
							<Wallet size={15} /> Record release
						</Button>
						<Button onClick={() => setCreateOpen(true)}>
							<PlusCircle size={15} /> New plan
						</Button>
					</div>
				}
			>
				<DataTable columns={columns} rows={rows} getKey={(r) => r.planId} />
				<p className="mt-3 text-xs text-[var(--color-muted)]">
					Available = released − spent. Recording a release increases both
					released and available. Each branch has one active plan in v1 — use{" "}
					<span className="font-medium">Manage</span> to edit a plan's target or
					close it, which frees the branch for a new plan.
				</p>
			</SectionCard>

			<CreatePlanModal
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onCreate={(input) => addFundingPlan(input)}
			/>
			<FundReleaseModal
				open={releaseOpen}
				onClose={() => setReleaseOpen(false)}
			/>
			<EditPlanModal
				open={editPlan !== null}
				onClose={() => setEditPlan(null)}
				plan={editPlan}
			/>
			{addTargetPlan && (
				<AddToTargetModal
					row={addTargetPlan}
					onClose={() => setAddTargetPlan(null)}
				/>
			)}
		</div>
	);
}

function AddToTargetModal({
	row,
	onClose,
}: {
	row: PlanRow;
	onClose: () => void;
}) {
	const { addToPlanTarget } = useStore();
	const [amount, setAmount] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const add = Number(amount);
	const newTargetLocal = row.targetLocal + (add > 0 ? add : 0);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!(add > 0)) return setError("Enter an amount greater than 0.");
		setBusy(true);
		setError(null);
		try {
			await addToPlanTarget(row.planId, toUsd(add, row.rate));
			onClose();
		} catch {
			setError("Could not update the target.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Modal
			open
			onClose={onClose}
			title={`Add to target — ${row.branchName}`}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="add-target-form" disabled={busy}>
						{busy ? "Adding…" : "Add to target"}
					</Button>
				</>
			}
		>
			<form id="add-target-form" onSubmit={handleSubmit} className="space-y-4">
				<div className="flex justify-between rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-sm">
					<span className="text-[var(--color-muted)]">Current target</span>
					<span className="font-semibold">
						{formatMoney(row.targetLocal, row.localCurrency)}
					</span>
				</div>
				<Field label={`Amount to add (${row.localCurrency})`} required>
					<Input
						type="number"
						min="0"
						step="0.01"
						placeholder="0.00"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
					/>
				</Field>
				<div className="flex justify-between rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm">
					<span className="text-[var(--color-muted)]">New target</span>
					<span className="font-bold text-[var(--color-forest-700)]">
						{formatMoney(newTargetLocal, row.localCurrency)}
					</span>
				</div>
				{error && (
					<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
						{error}
					</p>
				)}
			</form>
		</Modal>
	);
}

function CreatePlanModal({
	open,
	onClose,
	onCreate,
}: {
	open: boolean;
	onClose: () => void;
	onCreate: (input: {
		branchId: string;
		totalTargetUsd: number;
		description: string;
		status: FundingPlanStatus;
	}) => void;
}) {
	const { data } = useStore();
	// One active plan per branch — offer only branches without one.
	const available = data.branches.filter(
		(b) => !activePlanForBranch(data, b.id),
	);
	const [branchId, setBranchId] = useState(available[0]?.id ?? "");
	const [target, setTarget] = useState("");
	const [description, setDescription] = useState("");
	const [status, setStatus] = useState<FundingPlanStatus>("active");
	const [error, setError] = useState<string | null>(null);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const amt = Number(target);
		if (!branchId) return setError("Select a branch.");
		if (!Number.isFinite(amt) || amt <= 0)
			return setError("Enter a valid target amount.");
		onCreate({
			branchId,
			totalTargetUsd: Math.round(amt * 100) / 100,
			description: description.trim() || "Branch funding plan",
			status,
		});
		setTarget("");
		setDescription("");
		setError(null);
		onClose();
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Create funding plan"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="create-plan-form">
						Create plan
					</Button>
				</>
			}
		>
			<form id="create-plan-form" onSubmit={handleSubmit} className="space-y-4">
				<Field label="Branch" required>
					<Select
						value={branchId}
						onChange={(e) => setBranchId(e.target.value)}
					>
						{available.length === 0 && (
							<option value="">All branches already have a plan</option>
						)}
						{available.map((b) => (
							<option key={b.id} value={b.id}>
								{b.name}
							</option>
						))}
					</Select>
				</Field>
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
				<Field label="Status">
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
			</form>
		</Modal>
	);
}
