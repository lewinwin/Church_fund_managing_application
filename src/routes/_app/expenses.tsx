import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { useState } from "react";
import { ExpenseDetailDrawer } from "#/components/receipts/ExpenseDetailDrawer";
import { ExpenseTable } from "#/components/receipts/ExpenseTable";
import { EmptyState, SectionCard } from "#/components/ui/primitives";
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
			{expenses.length === 0 ? (
				<EmptyState
					icon={<Receipt size={20} />}
					title="No receipts yet"
					description="Upload your first receipt to start tracking spending."
				/>
			) : (
				<ExpenseTable
					expenses={expenses}
					categories={data.categories}
					onSelect={setSelected}
					branchName={branch.name}
					showUsd={false}
				/>
			)}

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
