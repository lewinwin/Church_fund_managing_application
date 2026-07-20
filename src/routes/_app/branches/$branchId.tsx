import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PlusCircle, Settings2 } from "lucide-react";
import { useState } from "react";
import { FundOverview } from "#/components/dashboard/FundOverview";
import { EditPlanModal } from "#/components/funding/EditPlanModal";
import { FundReleaseModal } from "#/components/funding/FundReleaseModal";
import { ExpenseDetailDrawer } from "#/components/receipts/ExpenseDetailDrawer";
import { GroupedExpenseList } from "#/components/receipts/GroupedExpenseList";
import { HqReviewCard } from "#/components/receipts/HqReviewCard";
import { type Column, DataTable } from "#/components/ui/DataTable";
import {
	Badge,
	Button,
	EmptyState,
	SectionCard,
} from "#/components/ui/primitives";
import {
	activePlanForBranch,
	branchById,
	branchFinancials,
	expensesForBranch,
	releasesForBranch,
	userById,
} from "#/lib/calc";
import { usdToLocal } from "#/lib/currency/exchangeRate";
import { formatDate, formatMoney } from "#/lib/format";
import { useStore } from "#/lib/store/store";
import type { Expense, FundRelease } from "#/lib/types";

export const Route = createFileRoute("/_app/branches/$branchId")({
	component: BranchDetailPage,
});

function BranchDetailPage() {
	const { branchId } = Route.useParams();
	const { data } = useStore();
	const [selected, setSelected] = useState<Expense | null>(null);
	const [releaseOpen, setReleaseOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);

	const branch = branchById(data.branches, branchId);
	if (!branch) {
		return (
			<EmptyState
				title="Branch not found"
				description="This branch doesn't exist."
				action={
					<Link to="/branches">
						<Button variant="ghost">Back to branches</Button>
					</Link>
				}
			/>
		);
	}

	// This branch's own currency drives every figure on the page.
	const cur = branch.localCurrency;
	const rate = branch.exchangeRateToUsd;
	const local = (usd: number) => formatMoney(usdToLocal(usd, rate), cur);

	const fin = branchFinancials(data, branch.id);
	const expenses = expensesForBranch(data, branch.id);
	// Transactions awaiting HQ attention: OCR-flagged, resubmitted, or still checking.
	const toReview = expenses.filter(
		(e) =>
			e.reviewStatus === "need_check" ||
			e.reviewStatus === "after_modify_check" ||
			e.reviewStatus === "checking",
	);
	const releases = releasesForBranch(data, branch.id).sort((a, b) =>
		a.releaseDate < b.releaseDate ? 1 : -1,
	);
	const plan = activePlanForBranch(data, branch.id);

	const releaseColumns: Column<FundRelease>[] = [
		{
			key: "date",
			header: "Release date",
			render: (r) => formatDate(r.releaseDate),
		},
		{
			key: "amount",
			header: `Amount (${cur})`,
			align: "right",
			render: (r) => <span className="font-semibold">{local(r.amountUsd)}</span>,
		},
		{
			key: "note",
			header: "Note",
			render: (r) => (
				<span className="text-[var(--color-muted)]">{r.note ?? "—"}</span>
			),
		},
		{
			key: "by",
			header: "Recorded by",
			render: (r) => userById(data.users, r.createdByUserId)?.name ?? "—",
		},
	];

	return (
		<div className="space-y-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<Link
						to="/branches"
						className="mb-1 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-forest-700)] hover:underline"
					>
						<ArrowLeft size={15} /> All branches
					</Link>
					<div className="flex items-center gap-3">
						<h2 className="text-xl font-bold">{branch.name}</h2>
						<Badge tone="neutral">
							{branch.country} · {cur}
						</Badge>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{plan && (
						<Button variant="ghost" onClick={() => setEditOpen(true)}>
							<Settings2 size={16} /> Manage plan
						</Button>
					)}
					<Button onClick={() => setReleaseOpen(true)}>
						<PlusCircle size={16} /> Record fund release
					</Button>
				</div>
			</div>

			<FundOverview
				title="Fund balance"
				releasedUsd={fin.releasedUsd}
				spentUsd={fin.spentUsd}
				remainingUsd={fin.remainingUsd}
				percentUsed={fin.percentUsed}
				status={fin.status}
				displayCurrency={cur}
				displayRate={rate}
				localLine={
					plan
						? `Active plan: ${plan.description} · Target ${local(
								plan.totalTargetUsd,
							)}`
						: "No active funding plan for this branch."
				}
			/>

			{toReview.length > 0 && (
				<SectionCard
					title={`Transactions to review (${toReview.length})`}
				>
					<div className="space-y-3">
						{toReview.map((e) => (
							<HqReviewCard
								key={e.id}
								expense={e}
								categories={data.categories}
								currency={cur}
							/>
						))}
					</div>
				</SectionCard>
			)}

			<SectionCard title="Fund release history">
				<DataTable
					columns={releaseColumns}
					rows={releases}
					getKey={(r) => r.id}
					empty={
						<EmptyState
							title="No releases yet"
							description="Record the first fund release for this branch."
						/>
					}
				/>
			</SectionCard>

			<SectionCard title="Expenses">
				<GroupedExpenseList
					expenses={expenses}
					categories={data.categories}
					currency={cur}
					onSelect={setSelected}
				/>
			</SectionCard>

			<ExpenseDetailDrawer
				expense={selected}
				categories={data.categories}
				branches={data.branches}
				users={data.users}
				onClose={() => setSelected(null)}
				showUsd={false}
			/>
			<FundReleaseModal
				open={releaseOpen}
				onClose={() => setReleaseOpen(false)}
				defaultBranchId={branch.id}
			/>
			<EditPlanModal
				open={editOpen}
				onClose={() => setEditOpen(false)}
				plan={plan ?? null}
			/>
		</div>
	);
}
