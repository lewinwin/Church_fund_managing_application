import { PencilLine } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Drawer } from "#/components/ui/Overlay";
import { Badge, Button } from "#/components/ui/primitives";
import { EditExpenseForm } from "./EditExpenseForm";
import { useAuth } from "#/lib/auth/auth";
import { categoryLabel } from "#/lib/calc";
import { availableActions, isResolved } from "#/lib/reviewLifecycle";
import {
	formatDate,
	formatDateTime,
	formatMoney,
	formatUsd,
} from "#/lib/format";
import type { Branch, Category, Expense, User } from "#/lib/types";
import { ReceiptPreview } from "./ReceiptPreview";
import { ReviewBadge } from "./ReviewBadge";
import { ReviewPanel } from "./ReviewPanel";

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
	showUsd = true,
}: {
	expense: Expense | null;
	categories: Category[];
	branches: Branch[];
	users: User[];
	onClose: () => void;
	/** HQ views show USD + exchange rate; branch views (local only) hide them. */
	showUsd?: boolean;
}) {
	const { user } = useAuth();
	// Correcting happens beside the drawer, so the receipt stays on screen.
	const [correcting, setCorrecting] = useState(false);

	// Reset the form whenever a different receipt is opened/closed.
	useEffect(() => {
		setCorrecting(false);
	}, [expense]);
	const branch = expense
		? branches.find((b) => b.id === expense.branchId)
		: undefined;
	const submitter = expense
		? users.find((u) => u.id === expense.submittedByUserId)
		: undefined;

	// HQ reviews (and decides on) a transaction right here, alongside the receipt —
	// no need to go back to the queue. Shown until the lifecycle says it's resolved.
	const showReview =
		user?.role === "hq_admin" &&
		expense != null &&
		!isResolved(expense.reviewStatus);

	// The branch's own correction box: HQ's reason plus the resubmit action, so a
	// returned transaction can be fixed without going back to the list.
	const showCorrect =
		user?.role === "branch_user" &&
		expense != null &&
		availableActions(expense.reviewStatus, "branch_user").includes("edit");

	// While HQ reviews, the decision panel rides alongside the drawer (to its
	// left) rather than inside it — full width for the comparison, and the
	// receipt stays visible next to it.
	const reviewPanel = expense ? (
		<ReviewPanel
			expense={expense}
			categories={categories}
			currency={expense.localCurrency}
			// HQ is done once a decision lands — close the drawer. (The parent's
			// `selected` snapshot is stale, so the panel can't rely on the status
			// flipping to hide itself.)
			onResolved={onClose}
		/>
	) : null;

	// The branch's correction form uses the same side slot, so the receipt stays
	// visible while the details are being fixed.
	const correctionForm =
		expense && correcting ? (
			<div>
				<h4 className="mb-3 text-base font-semibold">Correct &amp; resubmit</h4>
				<EditExpenseForm
					expense={expense}
					onDone={() => {
						setCorrecting(false);
						onClose();
					}}
					onCancel={() => setCorrecting(false)}
				/>
			</div>
		) : null;

	return (
		<Drawer
			open={!!expense}
			onClose={onClose}
			title="Receipt detail"
			aside={showReview ? reviewPanel : (correctionForm ?? undefined)}
		>
			{expense && (
				<div className="space-y-5">
					<div className="flex items-center justify-between gap-3">
						<div className="flex flex-wrap items-center gap-2">
							<h4 className="text-lg font-bold">{expense.description}</h4>
							<ReviewBadge status={expense.reviewStatus} />
						</div>
						<Badge tone="lime">
							{showUsd
								? formatUsd(expense.usdAmount)
								: formatMoney(expense.localAmount, expense.localCurrency)}
						</Badge>
					</div>

					{showCorrect && (
						<div className="rounded-xl border border-[#c9d8f5] bg-[#f4f7fe] p-4">
							<p className="text-sm font-semibold text-[#2f5bb7]">
								HQ returned this for correction
							</p>
							{expense.reviewNote && (
								<p className="mt-1 text-sm text-[#2f5bb7]">
									<span className="font-semibold">Note:</span>{" "}
									{expense.reviewNote}
								</p>
							)}
							<p className="mt-1 text-sm text-[var(--color-muted)]">
								Check the receipt below, then update the details to match it.
							</p>
							{!correcting && (
								<Button className="mt-3" onClick={() => setCorrecting(true)}>
									<PencilLine size={15} /> Correct &amp; resubmit
								</Button>
							)}
						</div>
					)}

					{/* Below lg there's no room beside the drawer, so the correction
					    form falls back to inside it. */}
					{correcting && (
						<div className="rounded-xl border border-[var(--color-line)] p-4 lg:hidden">
							{correctionForm}
						</div>
					)}

					<div className="space-y-5">
						<ReceiptPreview
							dataUrl={expense.receiptDataUrl}
							fileName={expense.receiptFileName}
						/>

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
							<Row label={showUsd ? "Local amount" : "Amount"}>
								{formatMoney(expense.localAmount, expense.localCurrency)}
							</Row>
							{showUsd && (
								<Row label="Exchange rate">
									1 {expense.localCurrency} = {expense.exchangeRateToUsd} USD
								</Row>
							)}
							{showUsd && (
								<Row label="USD equivalent">{formatUsd(expense.usdAmount)}</Row>
							)}
							<Row label="Submitted by">{submitter?.name ?? "—"}</Row>
							<Row label="Submitted at">
								{formatDateTime(expense.createdAt)}
							</Row>
							<Row label="OCR confidence">
								{expense.ocrConfidence != null
									? `${Math.round(expense.ocrConfidence * 100)}%`
									: "Manual entry"}
							</Row>
						</div>
					</div>

					{/* Below lg there's no room for the side panel, so the review
					    controls fall back to inside the drawer. */}
					{showReview && (
						<div className="rounded-xl border border-[var(--color-line)] p-4 lg:hidden">
							{reviewPanel}
						</div>
					)}

					{showUsd && (
						<p className="rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
							Exchange rate was snapshotted at entry time and is never
							recalculated when rates change.
						</p>
					)}
				</div>
			)}
		</Drawer>
	);
}
