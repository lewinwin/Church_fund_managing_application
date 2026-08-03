import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Upload, Wallet } from "lucide-react";
import { useState } from "react";
import { CategoryDonutCard } from "#/components/dashboard/CategoryDonutCard";
import { FundOverview } from "#/components/dashboard/FundOverview";
import { RecentExpenses } from "#/components/dashboard/RecentExpenses";
import { ExpenseDetailDrawer } from "#/components/receipts/ExpenseDetailDrawer";
import { Button, EmptyState, SectionCard } from "#/components/ui/primitives";
import { StatCard } from "#/components/ui/StatCard";
import { activePlanForBranch, expensesForBranch } from "#/lib/calc";
import { formatMoney } from "#/lib/format";
import { ledgerFor } from "#/lib/ledger";
import { useStore } from "#/lib/store/store";
import type { Branch, Expense } from "#/lib/types";

export function BranchDashboard({ branch }: { branch: Branch }) {
	const { data } = useStore();
	const [selected, setSelected] = useState<Expense | null>(null);

	const led = ledgerFor(data, branch.id);
	// All expenses drive the display list + count; the ledger owns the money.
	const expenses = expensesForBranch(data, branch.id);
	const plan = activePlanForBranch(data, branch.id);
	const cur = branch.localCurrency;

	return (
		<div className="space-y-5">
			{/* Redundant with the Fund balance card below, so hidden on mobile —
			    this puts Fund balance at the top on phones. */}
			<div className="hidden gap-4 sm:grid sm:grid-cols-3">
				<StatCard
					label="Total released"
					value={formatMoney(led.released, cur)}
					icon={<Wallet size={17} />}
					sub="Funds received from HQ"
				/>
				<StatCard
					label="Total spent"
					value={formatMoney(led.spent, cur)}
					accent="red"
					icon={<ArrowUpRight size={17} />}
					sub={`${expenses.length} receipts`}
				/>
				<StatCard
					label="Remaining"
					value={formatMoney(led.remaining, cur)}
					accent="lime"
					icon={<ArrowDownRight size={17} />}
					sub="Available to spend"
				/>
			</div>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
				<div className="space-y-5 lg:col-span-2">
					<FundOverview
						title="Fund balance"
						released={led.released}
						spent={led.spent}
						remaining={led.remaining}
						percentUsed={led.percentUsed}
						status={led.status}
						currency={cur}
						localLine={`All figures are in ${cur}.`}
					/>

					<SectionCard
						title="Recent transactions"
						action={
							<Link to="/expenses">
								<Button variant="ghost">View all</Button>
							</Link>
						}
					>
						<RecentExpenses
							expenses={expenses}
							categories={data.categories}
							branches={data.branches}
							onSelect={setSelected}
						/>
					</SectionCard>
				</div>

				<div className="space-y-5">
					<SectionCard title="Quick actions">
						<div className="space-y-2">
							<Link to="/submit-receipt" className="block">
								<Button className="w-full justify-start">
									<Upload size={16} /> Upload a receipt
								</Button>
							</Link>
							<Link to="/reports" className="block">
								<Button variant="ghost" className="w-full justify-start">
									Export branch report
								</Button>
							</Link>
						</div>
						{plan ? (
							<p className="mt-3 rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
								Active plan: {plan.description}
							</p>
						) : (
							<p className="mt-3 rounded-lg bg-[#fbf1dd] px-3 py-2 text-xs text-[#b7841f]">
								No active funding plan yet. Contact HQ.
							</p>
						)}
					</SectionCard>

					{expenses.length === 0 ? (
						<SectionCard title="Expense by category">
							<EmptyState
								title="No spending yet"
								description="Upload your first receipt to see the breakdown."
							/>
						</SectionCard>
					) : (
						<CategoryDonutCard categorySlices={led.byCategory} currency={cur} />
					)}
				</div>
			</div>

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
