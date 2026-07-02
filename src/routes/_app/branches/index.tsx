import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { type Column, DataTable } from "#/components/ui/DataTable";
import {
	ProgressBar,
	SectionCard,
	StatusPill,
} from "#/components/ui/primitives";
import { branchFinancials } from "#/lib/calc";
import { formatPercent, formatUsd } from "#/lib/format";
import { useStore } from "#/lib/store/store";

export const Route = createFileRoute("/_app/branches/")({
	component: BranchesPage,
});

function BranchesPage() {
	const { data } = useStore();
	const navigate = useNavigate();

	const rows = data.branches.map((b) => ({
		branch: b,
		fin: branchFinancials(data, b.id),
	}));

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
			render: (r) => formatUsd(r.fin.releasedUsd),
		},
		{
			key: "spent",
			header: "Spent",
			align: "right",
			render: (r) => formatUsd(r.fin.spentUsd),
		},
		{
			key: "remaining",
			header: "Remaining",
			align: "right",
			render: (r) => (
				<span className="font-semibold">{formatUsd(r.fin.remainingUsd)}</span>
			),
		},
		{
			key: "usage",
			header: "Usage",
			render: (r) => (
				<div className="flex min-w-[120px] items-center gap-2">
					<ProgressBar
						value={r.fin.percentUsed}
						tone={
							r.fin.status === "low"
								? "red"
								: r.fin.status === "warning"
									? "amber"
									: "forest"
						}
						className="flex-1"
					/>
					<span className="w-10 text-right text-xs text-[var(--color-muted)]">
						{formatPercent(r.fin.percentUsed)}
					</span>
				</div>
			),
		},
		{
			key: "status",
			header: "Status",
			render: (r) => <StatusPill status={r.fin.status} />,
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
	);
}
