// A single flagged transaction in the "Needs Check" queue: a summary header plus
// the shared review panel (comparison + HQ's Cancel/Modify/Correct decision).
// The same panel also appears inside the transaction detail drawer.
import { categoryLabel } from "#/lib/calc";
import { formatDate, formatMoney } from "#/lib/format";
import type { Category, CurrencyCode, Expense } from "#/lib/types";
import { ReviewBadge } from "./ReviewBadge";
import { ReviewPanel } from "./ReviewPanel";

export function HqReviewCard({
	expense,
	categories,
	currency,
	branchName,
}: {
	expense: Expense;
	categories: Category[];
	currency: CurrencyCode;
	/** Shown in the cross-branch queue; omit on a single-branch page. */
	branchName?: string;
}) {
	const catText = categoryLabel(
		categories,
		expense.categoryId,
		expense.otherSubcategoryId,
	);

	return (
		<div className="rounded-xl border border-[var(--color-line)] p-4">
			<div className="mb-3">
				<div className="flex items-center gap-2">
					<span className="font-semibold">{expense.description}</span>
					<ReviewBadge status={expense.reviewStatus} />
				</div>
				<p className="mt-0.5 text-sm text-[var(--color-muted)]">
					{branchName ? `${branchName} · ` : ""}
					{catText} · {formatMoney(expense.localAmount, currency)} ·{" "}
					{formatDate(expense.expenseDate)}
				</p>
			</div>
			<ReviewPanel
				expense={expense}
				categories={categories}
				currency={currency}
			/>
		</div>
	);
}
