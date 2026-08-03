import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { type Column, DataTable } from "#/components/ui/DataTable";
import {
	EmptyState,
	ProgressBar,
	SectionCard,
} from "#/components/ui/primitives";
import { formatAmount, formatPercent } from "#/lib/format";
import { ledgerFor } from "#/lib/ledger";
import { availableActions } from "#/lib/reviewLifecycle";
import { useStore } from "#/lib/store/store";

export const Route = createFileRoute("/_app/branches/")({
	component: BranchesPage,
});

function BranchesPage() {
	const { data } = useStore();
	const navigate = useNavigate();

	// Each branch's figures are shown in its OWN local currency (matching the
	// branch detail page), with no symbol — the code is under the branch name.
	const rows = data.branches.map((b) => ({
		branch: b,
		led: ledgerFor(data, b.id),
	}));

	// Cross-branch review queue: everything HQ can currently act on (OCR-flagged or
	// resubmitted after a modify).
	const flagged = data.expenses.filter(
		(e) => availableActions(e.reviewStatus, "hq_admin").length > 0,
	);

	// Rolled up to a brief "Branch: N Checks" notification — HQ does the actual
	// review/decision on the branch detail page, not here. Busiest branch first.
	const checksByBranch = data.branches
		.map((b) => ({
			branch: b,
			count: flagged.filter((e) => e.branchId === b.id).length,
		}))
		.filter((r) => r.count > 0)
		.sort((a, b) => b.count - a.count);

	const columns: Column<(typeof rows)[number]>[] = [
		{
			key: "name",
			header: "Branch",
			render: (r) => (
				<div>
					<p className="font-medium text-[var(--color-ink)]">{r.branch.name}</p>
					<p className="text-xs text-[var(--color-muted)]">
						{r.branch.country} · {r.branch.localCurrency}
					</p>
				</div>
			),
		},
		{
			key: "released",
			header: "Released",
			align: "right",
			render: (r) => formatAmount(r.led.released, r.led.currency),
		},
		{
			key: "spent",
			header: "Spent",
			align: "right",
			render: (r) => formatAmount(r.led.spent, r.led.currency),
		},
		{
			key: "remaining",
			header: "Remaining",
			align: "right",
			render: (r) => (
				<span className="font-semibold">
					{formatAmount(r.led.remaining, r.led.currency)}
				</span>
			),
		},
		{
			key: "usage",
			header: "Usage",
			render: (r) => (
				<div className="flex min-w-[120px] items-center gap-2">
					<ProgressBar
						value={r.led.percentUsed}
						tone={
							r.led.status === "low"
								? "red"
								: r.led.status === "warning"
									? "amber"
									: "forest"
						}
						className="flex-1"
					/>
					<span className="w-10 text-right text-xs text-[var(--color-muted)]">
						{formatPercent(r.led.percentUsed)}
					</span>
				</div>
			),
		},
		{
			key: "go",
			header: "",
			align: "right",
			render: () => (
				<ChevronRight size={16} className="text-[var(--color-muted)]" />
			),
		},
	];

	return (
		<div className="space-y-5">
			<SectionCard
				title={
					<span className="flex items-center gap-2">
						<AlertTriangle size={16} className="text-[var(--color-warning)]" />
						Needs Check ({flagged.length})
					</span>
				}
			>
				{flagged.length === 0 ? (
					<EmptyState
						title="Nothing to review"
						description="Transactions that don't match their receipt will appear here for review."
					/>
				) : (
					<div className="divide-y divide-[var(--color-line)]">
						{checksByBranch.map(({ branch, count }) => (
							<button
								key={branch.id}
								type="button"
								onClick={() =>
									navigate({
										to: "/branches/$branchId",
										params: { branchId: branch.id },
									})
								}
								className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-3 text-left transition-colors hover:bg-[var(--color-forest-50)]"
							>
								<span className="font-medium text-[var(--color-ink)]">
									{branch.name}
								</span>
								<span className="flex items-center gap-2">
									<span className="rounded-full bg-[#fdf1dc] px-2.5 py-1 text-xs font-semibold text-[var(--color-warning)]">
										{count} {count === 1 ? "Check" : "Checks"}
									</span>
									<ChevronRight
										size={16}
										className="text-[var(--color-muted)]"
									/>
								</span>
							</button>
						))}
					</div>
				)}
			</SectionCard>

			<SectionCard title="All branches">
				<DataTable
					columns={columns}
					rows={rows}
					getKey={(r) => r.branch.id}
					onRowClick={(r) =>
						navigate({
							to: "/branches/$branchId",
							params: { branchId: r.branch.id },
						})
					}
				/>
			</SectionCard>
		</div>
	);
}
