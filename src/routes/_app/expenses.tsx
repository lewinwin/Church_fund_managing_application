import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ExpenseDetailDrawer } from "#/components/receipts/ExpenseDetailDrawer";
import { GroupedExpenseList } from "#/components/receipts/GroupedExpenseList";
import { SectionCard } from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { branchById, expensesForBranch } from "#/lib/calc";
import { useStore } from "#/lib/store/store";
import type { Expense } from "#/lib/types";

export const Route = createFileRoute("/_app/expenses")({
	component: ExpensesPage,
});

function ExpensesPage() {
	const { user } = useAuth();
	const { data } = useStore();
	const [selected, setSelected] = useState<Expense | null>(null);

	const branch = branchById(data.branches, user?.branchId ?? null);
	if (!branch) return null;

	// Data isolation: only this branch's expenses are ever loaded.
	const expenses = expensesForBranch(data, branch.id);

	return (
		<SectionCard
			title={`${branch.name} receipts`}
			action={
				<span className="text-sm text-[var(--color-muted)]">
					{expenses.length} total
				</span>
			}
		>
			<GroupedExpenseList
				expenses={expenses}
				categories={data.categories}
				currency={branch.localCurrency}
				onSelect={setSelected}
			/>

			<ExpenseDetailDrawer
				expense={selected}
				categories={data.categories}
				branches={data.branches}
				users={data.users}
				onClose={() => setSelected(null)}
				showUsd={false}
			/>
		</SectionCard>
	);
}
