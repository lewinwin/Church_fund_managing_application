import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useState } from "react";
import { FundOverview } from "#/components/dashboard/FundOverview";
import { ExpenseDetailDrawer } from "#/components/receipts/ExpenseDetailDrawer";
import { GroupedExpenseList } from "#/components/receipts/GroupedExpenseList";
import { Button, SectionCard } from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import {
	activePlanForBranch,
	branchById,
	branchFinancials,
	expensesForBranch,
} from "#/lib/calc";
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
	const fin = branchFinancials(data, branch.id);
	const plan = activePlanForBranch(data, branch.id);
	const cur = branch.localCurrency;

	return (
		<div className="space-y-5">
			<FundOverview
				title="Fund balance"
				releasedUsd={fin.releasedUsd}
				spentUsd={fin.spentUsd}
				remainingUsd={fin.remainingUsd}
				percentUsed={fin.percentUsed}
				status={fin.status}
				displayCurrency={cur}
				displayRate={branch.exchangeRateToUsd}
				localLine={
					plan
						? `Active plan: ${plan.description} · all figures in ${cur}.`
						: `All figures shown in ${cur} at the current exchange rate.`
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

			<ExpenseDetailDrawer
				expense={selected}
				categories={data.categories}
				branches={data.branches}
				users={data.users}
				onClose={() => setSelected(null)}
				showUsd={false}
			/>
		</div>
	);
}
