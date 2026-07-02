import { Receipt } from "lucide-react";
import { EmptyState } from "#/components/ui/primitives";
import { categoryLabel } from "#/lib/calc";
import { formatDate, formatMoney, formatUsd } from "#/lib/format";
import type { Branch, Category, Expense } from "#/lib/types";

// Compact recent-activity list for dashboards.
export function RecentExpenses({
	expenses,
	categories,
	branches,
	limit = 6,
	onSelect,
	showBranch,
}: {
	expenses: Expense[];
	categories: Category[];
	branches: Branch[];
	limit?: number;
	onSelect?: (expense: Expense) => void;
	showBranch?: boolean;
}) {
	const rows = [...expenses]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, limit);

	if (rows.length === 0) {
		return (
			<EmptyState
				icon={<Receipt size={20} />}
				title="No recent activity"
				description="Submitted receipts will appear here."
			/>
		);
	}

	return (
		<ul className="divide-y divide-[var(--color-line)]">
			{rows.map((e) => {
				const branch = branches.find((b) => b.id === e.branchId);
				return (
					<li key={e.id}>
						<button
							type="button"
							disabled={!onSelect}
							onClick={onSelect ? () => onSelect(e) : undefined}
							className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
						>
							<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-50)] text-[var(--color-forest-600)]">
								<Receipt size={16} />
							</span>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-[var(--color-ink)]">
									{e.merchantName}
								</p>
								<p className="truncate text-xs text-[var(--color-muted)]">
									{showBranch && branch ? `${branch.name} · ` : ""}
									{categoryLabel(
										categories,
										e.categoryId,
										e.otherSubcategoryId,
									)}{" "}
									· {formatDate(e.expenseDate)}
								</p>
							</div>
							<div className="text-right">
								<p className="text-sm font-semibold text-[var(--color-ink)]">
									{formatUsd(e.usdAmount)}
								</p>
								<p className="text-xs text-[var(--color-muted)]">
									{formatMoney(e.localAmount, e.localCurrency)}
								</p>
							</div>
						</button>
					</li>
				);
			})}
		</ul>
	);
}
