import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, PlusCircle, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { BarChart } from "#/components/charts/BarChart";
import { CategoryDonutCard } from "#/components/dashboard/CategoryDonutCard";
import { FundOverview } from "#/components/dashboard/FundOverview";
import { RecentExpenses } from "#/components/dashboard/RecentExpenses";
import { FundReleaseModal } from "#/components/funding/FundReleaseModal";
import { ExpenseDetailDrawer } from "#/components/receipts/ExpenseDetailDrawer";
import { type Column, DataTable } from "#/components/ui/DataTable";
import { Button, SectionCard, StatusPill } from "#/components/ui/primitives";
import { StatCard } from "#/components/ui/StatCard";
import { branchFinancials, globalTotals, spendByBranch } from "#/lib/calc";
import { formatPercent, formatUsd } from "#/lib/format";
import { useStore } from "#/lib/store/store";
import type { Expense } from "#/lib/types";

export function HqDashboard() {
	const { data } = useStore();
	const navigate = useNavigate();
	const [selected, setSelected] = useState<Expense | null>(null);
	const [releaseOpen, setReleaseOpen] = useState(false);

	const totals = globalTotals(data);
	const branchRows = data.branches.map((b) => ({
		branch: b,
		fin: branchFinancials(data, b.id),
	}));
	const branchBars = spendByBranch(data).map((s) => ({
		label: s.label,
		value: s.usd,
	}));

	const columns: Column<(typeof branchRows)[number]>[] = [
		{
			key: "name",
			header: "Branch",
			render: (r) => (
				<span className="font-medium text-[var(--color-ink)]">
					{r.branch.name}
				</span>
			),
		},
		{ key: "country", header: "Country", render: (r) => r.branch.country },
		{
			key: "currency",
			header: "Currency",
			render: (r) => r.branch.localCurrency,
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
			key: "used",
			header: "% used",
			align: "right",
			render: (r) => formatPercent(r.fin.percentUsed),
		},
		{
			key: "status",
			header: "Status",
			render: (r) => <StatusPill status={r.fin.status} />,
		},
	];

	return (
		<div className="space-y-5">
			{/* On mobile, show the consolidated fund usage first, then a compact
			    2-col KPI grid. Desktop keeps KPIs on top (order utilities). */}
			<div className="flex flex-col gap-5">
				<div className="order-2 grid grid-cols-2 gap-4 lg:order-1 xl:grid-cols-4">
					<StatCard
						label="Total released"
						value={formatUsd(totals.releasedUsd)}
						icon={<Wallet size={17} />}
						sub="Across all branches"
					/>
					<StatCard
						label="Total spent"
						value={formatUsd(totals.spentUsd)}
						accent="red"
						icon={<ArrowUpRight size={17} />}
						sub={`${data.expenses.length} receipts`}
					/>
					<StatCard
						label="Total remaining"
						value={formatUsd(totals.remainingUsd)}
						accent="lime"
						icon={<TrendingUp size={17} />}
						sub={`${formatPercent(totals.percentUsed)} of funds used`}
					/>
					<StatCard
						label="Branches at risk"
						value={`${totals.low + totals.warning}`}
						accent={totals.low > 0 ? "red" : "amber"}
						icon={<ArrowUpRight size={17} />}
						sub={`${totals.low} low · ${totals.warning} warning · ${totals.healthy} healthy`}
					/>
				</div>

				<div className="order-1 grid grid-cols-1 gap-5 lg:order-2 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<FundOverview
							title="Consolidated fund usage (USD)"
							releasedUsd={totals.releasedUsd}
							spentUsd={totals.spentUsd}
							remainingUsd={totals.remainingUsd}
							percentUsed={totals.percentUsed}
						/>
					</div>
					<SectionCard title="Quick action">
						<Button
							className="w-full justify-start"
							onClick={() => setReleaseOpen(true)}
						>
							<PlusCircle size={16} /> Record fund release
						</Button>
						<Link to="/funding-plans" className="mt-2 block">
							<Button variant="ghost" className="w-full justify-start">
								Manage funding plans
							</Button>
						</Link>
					</SectionCard>
				</div>
			</div>

			<SectionCard title="Branch funding status">
				<DataTable
					columns={columns}
					rows={branchRows}
					getKey={(r) => r.branch.id}
					onRowClick={(r) =>
						navigate({
							to: "/branches/$branchId",
							params: { branchId: r.branch.id },
						})
					}
				/>
				<p className="mt-3 text-xs text-[var(--color-muted)]">
					Click a branch to open its detail page.
				</p>
			</SectionCard>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
				<SectionCard title="Spending by branch (USD)">
					<BarChart bars={branchBars} formatValue={formatUsd} />
				</SectionCard>
				<CategoryDonutCard
					expenses={data.expenses}
					categories={data.categories}
					title="Expense by category (all branches)"
				/>
			</div>

			<SectionCard title="Recent expenses across all branches">
				<RecentExpenses
					expenses={data.expenses}
					categories={data.categories}
					branches={data.branches}
					limit={8}
					showBranch
					onSelect={setSelected}
				/>
			</SectionCard>

			<ExpenseDetailDrawer
				expense={selected}
				categories={data.categories}
				branches={data.branches}
				users={data.users}
				onClose={() => setSelected(null)}
			/>
			<FundReleaseModal
				open={releaseOpen}
				onClose={() => setReleaseOpen(false)}
			/>
		</div>
	);
}
