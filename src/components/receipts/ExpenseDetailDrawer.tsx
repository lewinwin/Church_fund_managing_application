import type { ReactNode } from "react";
import { Drawer } from "#/components/ui/Overlay";
import { Badge } from "#/components/ui/primitives";
import { categoryLabel } from "#/lib/calc";
import {
	formatDate,
	formatDateTime,
	formatMoney,
	formatUsd,
} from "#/lib/format";
import type { Branch, Category, Expense, User } from "#/lib/types";
import { ReceiptPreview } from "./ReceiptPreview";

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] py-2.5 last:border-0">
			<span className="text-sm text-[var(--color-muted)]">{label}</span>
			<span className="text-right text-sm font-medium text-[var(--color-ink)]">
				{children}
			</span>
		</div>
	);
}

export function ExpenseDetailDrawer({
	expense,
	categories,
	branches,
	users,
	onClose,
}: {
	expense: Expense | null;
	categories: Category[];
	branches: Branch[];
	users: User[];
	onClose: () => void;
}) {
	const branch = expense
		? branches.find((b) => b.id === expense.branchId)
		: undefined;
	const submitter = expense
		? users.find((u) => u.id === expense.submittedByUserId)
		: undefined;

	return (
		<Drawer open={!!expense} onClose={onClose} title="Receipt detail">
			{expense && (
				<div className="space-y-5">
					<div>
						<div className="mb-2 flex items-center justify-between">
							<h4 className="text-lg font-bold">{expense.merchantName}</h4>
							<Badge tone="lime">{formatUsd(expense.usdAmount)}</Badge>
						</div>
						<ReceiptPreview
							dataUrl={expense.receiptDataUrl}
							fileName={expense.receiptFileName}
						/>
					</div>

					<div className="rounded-xl border border-[var(--color-line)] px-4 py-1">
						<Row label="Branch">{branch?.name ?? "—"}</Row>
						<Row label="Expense date">{formatDate(expense.expenseDate)}</Row>
						<Row label="Category">
							{categoryLabel(
								categories,
								expense.categoryId,
								expense.otherSubcategoryId,
							)}
						</Row>
						<Row label="Local amount">
							{formatMoney(expense.localAmount, expense.localCurrency)}
						</Row>
						<Row label="Exchange rate">
							1 {expense.localCurrency} = {expense.exchangeRateToUsd} USD
						</Row>
						<Row label="USD equivalent">{formatUsd(expense.usdAmount)}</Row>
						<Row label="Submitted by">{submitter?.name ?? "—"}</Row>
						<Row label="Submitted at">{formatDateTime(expense.createdAt)}</Row>
						<Row label="OCR confidence">
							{expense.ocrConfidence != null
								? `${Math.round(expense.ocrConfidence * 100)}%`
								: "Manual entry"}
						</Row>
					</div>

					<p className="rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
						Exchange rate was snapshotted at entry time and is never
						recalculated when rates change.
					</p>
				</div>
			)}
		</Drawer>
	);
}
