import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PlusCircle, Settings2 } from "lucide-react";
import { useState } from "react";
import { FundOverview } from "#/components/dashboard/FundOverview";
import { EditPlanModal } from "#/components/funding/EditPlanModal";
import { FundReleaseHistory } from "#/components/funding/FundReleaseHistory";
import { FundReleaseModal } from "#/components/funding/FundReleaseModal";
import { ExpenseDetailDrawer } from "#/components/receipts/ExpenseDetailDrawer";
import { GroupedExpenseList } from "#/components/receipts/GroupedExpenseList";
import {
	Badge,
	Button,
	EmptyState,
	SectionCard,
} from "#/components/ui/primitives";
import {
	activePlanForBranch,
	branchById,
	expensesForBranch,
	releasesForBranch,
} from "#/lib/calc";
import { formatMoney } from "#/lib/format";
import { ledgerFor } from "#/lib/ledger";
import { useStore } from "#/lib/store/store";
import type { Expense } from "#/lib/types";

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

	const led = ledgerFor(data, branch.id);
	const expenses = expensesForBranch(data, branch.id);
	const releases = releasesForBranch(data, branch.id).sort((a, b) =>
		a.releaseDate < b.releaseDate ? 1 : -1,
	);
	const plan = activePlanForBranch(data, branch.id);

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
				released={led.released}
				spent={led.spent}
				remaining={led.remaining}
				percentUsed={led.percentUsed}
				status={led.status}
				currency={cur}
				localLine={
					plan
						? `Active plan: ${plan.description} · Target ${formatMoney(
								plan.totalTarget,
								cur,
							)}`
						: "No active funding plan for this branch."
				}
			/>

			<FundReleaseHistory
				releases={releases}
				users={data.users}
				currency={cur}
			/>

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
