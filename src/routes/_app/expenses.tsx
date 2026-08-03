import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useState } from "react";
import { FundOverview } from "#/components/dashboard/FundOverview";
import { ExpenseDetailDrawer } from "#/components/receipts/ExpenseDetailDrawer";
import { GroupedExpenseList } from "#/components/receipts/GroupedExpenseList";
import { Button, SectionCard } from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { FundReleaseHistory } from "#/components/funding/FundReleaseHistory";
import {
	activePlanForBranch,
	branchById,
	expensesForBranch,
	releasesForBranch,
} from "#/lib/calc";
import { ledgerFor } from "#/lib/ledger";
import { useStore } from "#/lib/store/store";
import type { Expense } from "#/lib/types";

export const Route = createFileRoute("/_app/expenses")({
	component: ExpensesPage,
});

// The branch user's home base: fund balance up top (released / spent /
// remaining in local currency), then every receipt grouped by month → day.
function ExpensesPage() {
	const { user } = useAuth();
	const { data } = useStore();
	const [selected, setSelected] = useState<Expense | null>(null);

	const branch = branchById(data.branches, user?.branchId ?? null);
	if (!branch) return null;

	// Data isolation: only this branch's expenses are ever loaded.
	const expenses = expensesForBranch(data, branch.id);
	const led = ledgerFor(data, branch.id);
	const plan = activePlanForBranch(data, branch.id);
	const cur = branch.localCurrency;

	return (
		<div className="space-y-5">
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
						? `Active plan: ${plan.description} · all figures in ${cur}.`
						: `All figures are in ${cur}.`
				}
			/>

			<SectionCard
				title={`${branch.name} receipts`}
				action={
					<div className="flex items-center gap-3">
						<span className="hidden text-sm text-[var(--color-muted)] sm:inline">
							{expenses.length} total
						</span>
						<Link to="/submit-receipt">
							<Button>
								<Upload size={16} /> Upload
							</Button>
						</Link>
					</div>
				}
			>
				<GroupedExpenseList
					expenses={expenses}
					categories={data.categories}
					currency={cur}
					onSelect={setSelected}
				/>
			</SectionCard>

			<FundReleaseHistory
				releases={releasesForBranch(data, branch.id).sort((a, b) =>
					a.releaseDate < b.releaseDate ? 1 : -1,
				)}
				users={data.users}
				currency={cur}
			/>

			<ExpenseDetailDrawer
				expense={selected}
				categories={data.categories}
				branches={data.branches}
				users={data.users}
				onClose={() => setSelected(null)}
			/>
		</div>
	);
}
