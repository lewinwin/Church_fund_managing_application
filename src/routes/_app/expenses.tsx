import { createFileRoute, Link } from "@tanstack/react-router";
import { PencilLine, Upload } from "lucide-react";
import { useState } from "react";
import { FundOverview } from "#/components/dashboard/FundOverview";
import { EditExpenseModal } from "#/components/receipts/EditExpenseModal";
import { ExpenseDetailDrawer } from "#/components/receipts/ExpenseDetailDrawer";
import { GroupedExpenseList } from "#/components/receipts/GroupedExpenseList";
import { Button, SectionCard } from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import {
	activePlanForBranch,
	branchById,
	branchFinancials,
	categoryLabel,
	expensesForBranch,
} from "#/lib/calc";
import { formatDate, formatMoney } from "#/lib/format";
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
	const [editing, setEditing] = useState<Expense | null>(null);

	const branch = branchById(data.branches, user?.branchId ?? null);
	if (!branch) return null;

	// Data isolation: only this branch's expenses are ever loaded.
	const expenses = expensesForBranch(data, branch.id);
	const returned = expenses.filter(
		(e) => e.reviewStatus === "modify_requested",
	);
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

			{returned.length > 0 && (
				<SectionCard title={`Returned to correct (${returned.length})`}>
					<div className="space-y-3">
						{returned.map((e) => (
							<div
								key={e.id}
								className="flex flex-col gap-3 rounded-xl border border-[#c9d8f5] bg-[#f4f7fe] p-4 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="min-w-0">
									<p className="font-semibold">{e.description}</p>
									<p className="mt-0.5 text-sm text-[var(--color-muted)]">
										{categoryLabel(
											data.categories,
											e.categoryId,
											e.otherSubcategoryId,
										)}{" "}
										· {formatMoney(e.localAmount, cur)} ·{" "}
										{formatDate(e.expenseDate)}
									</p>
									{e.reviewNote && (
										<p className="mt-1 text-sm text-[#2f5bb7]">
											<span className="font-semibold">HQ note:</span>{" "}
											{e.reviewNote}
										</p>
									)}
								</div>
								<Button className="shrink-0" onClick={() => setEditing(e)}>
									<PencilLine size={15} /> Correct & resubmit
								</Button>
							</div>
						))}
					</div>
				</SectionCard>
			)}

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
				onCorrect={setEditing}
			/>
			<EditExpenseModal expense={editing} onClose={() => setEditing(null)} />
		</div>
	);
}
