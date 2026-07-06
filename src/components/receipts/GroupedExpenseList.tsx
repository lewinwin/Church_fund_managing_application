import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, Select } from "#/components/ui/primitives";
import { categoryLabel } from "#/lib/calc";
import { formatMoney } from "#/lib/format";
import type { Category, CurrencyCode, Expense } from "#/lib/types";

// Reference-style accordion: Month → Day → Transactions, each level showing a
// total. Branch view only, so amounts are in local currency. Choosing a month
// shows its days; "All months" lists months collapsed until tapped.
export function GroupedExpenseList({
	expenses,
	categories,
	currency,
	onSelect,
}: {
	expenses: Expense[];
	categories: Category[];
	currency: CurrencyCode;
	onSelect: (expense: Expense) => void;
}) {
	const months = useMemo(() => groupByMonth(expenses), [expenses]);

	const [monthFilter, setMonthFilter] = useState("all");
	const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
	const [openDays, setOpenDays] = useState<Set<string>>(new Set());

	function toggle(set: Set<string>, key: string): Set<string> {
		const next = new Set(set);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		return next;
	}

	if (expenses.length === 0) {
		return (
			<EmptyState
				icon={<Receipt size={20} />}
				title="No receipts yet"
				description="Upload your first receipt to start tracking spending."
			/>
		);
	}

	const visible =
		monthFilter === "all" ? months : months.filter((m) => m.ym === monthFilter);

	return (
		<div className="space-y-3">
			<Select
				className="sm:w-56"
				value={monthFilter}
				onChange={(e) => setMonthFilter(e.target.value)}
			>
				<option value="all">All months</option>
				{months.map((m) => (
					<option key={m.ym} value={m.ym}>
						{formatMonth(m.ym)}
					</option>
				))}
			</Select>

			{visible.map((month) => {
				// A specific month filter keeps its days open; "all" starts collapsed.
				const monthOpen = monthFilter !== "all" || openMonths.has(month.ym);
				return (
					<div
						key={month.ym}
						className="overflow-hidden rounded-xl border border-[var(--color-line)]"
					>
						<button
							type="button"
							onClick={() => setOpenMonths((s) => toggle(s, month.ym))}
							className="flex w-full items-center justify-between gap-3 bg-[var(--color-forest-50)] px-4 py-3 text-left"
						>
							<span className="flex min-w-0 items-center gap-2 font-semibold text-[var(--color-ink)]">
								<Chevron open={monthOpen} />
								<span className="truncate">{formatMonth(month.ym)}</span>
							</span>
							<span className="shrink-0 font-bold text-[var(--color-negative)]">
								−{formatMoney(month.total, currency)}
							</span>
						</button>

						{monthOpen &&
							month.days.map((day) => {
								const dayOpen = openDays.has(day.day);
								return (
									<div
										key={day.day}
										className="border-t border-[var(--color-line)]"
									>
										<button
											type="button"
											onClick={() => setOpenDays((s) => toggle(s, day.day))}
											className="flex w-full items-center justify-between gap-3 px-4 py-2.5 pl-6 text-left"
										>
											<span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
												<Chevron open={dayOpen} small />
												<span className="truncate">
													{formatDayLabel(day.day)}
												</span>
												<span className="shrink-0 text-xs text-[var(--color-muted)]">
													· {day.items.length}
												</span>
											</span>
											<span className="shrink-0 text-sm font-semibold text-[var(--color-negative)]">
												−{formatMoney(day.total, currency)}
											</span>
										</button>

										{dayOpen &&
											day.items.map((e) => (
												<button
													key={e.id}
													type="button"
													onClick={() => onSelect(e)}
													className="flex w-full items-center justify-between gap-3 border-t border-[var(--color-line)] px-4 py-2.5 pl-11 text-left transition-colors hover:bg-[var(--color-forest-50)]"
												>
													<span className="min-w-0">
														<span className="block truncate text-sm text-[var(--color-ink)]">
															{e.description}
														</span>
														<span className="block truncate text-xs text-[var(--color-muted)]">
															{categoryLabel(
																categories,
																e.categoryId,
																e.otherSubcategoryId,
															)}
														</span>
													</span>
													<span className="shrink-0 text-sm font-semibold text-[var(--color-negative)]">
														−{formatMoney(e.localAmount, currency)}
													</span>
												</button>
											))}
									</div>
								);
							})}
					</div>
				);
			})}
		</div>
	);
}

function Chevron({ open, small }: { open: boolean; small?: boolean }) {
	const size = small ? 15 : 17;
	return open ? (
		<ChevronDown size={size} className="shrink-0 text-[var(--color-muted)]" />
	) : (
		<ChevronRight size={size} className="shrink-0 text-[var(--color-muted)]" />
	);
}

// ---------------------------------------------------------------------------

interface DayGroup {
	day: string;
	total: number;
	items: Expense[];
}
interface MonthGroup {
	ym: string;
	total: number;
	days: DayGroup[];
}

function groupByMonth(expenses: Expense[]): MonthGroup[] {
	const byMonth = new Map<string, Expense[]>();
	for (const e of expenses) {
		const ym = e.expenseDate.slice(0, 7); // YYYY-MM
		const list = byMonth.get(ym);
		if (list) list.push(e);
		else byMonth.set(ym, [e]);
	}

	return [...byMonth.entries()]
		.sort((a, b) => (a[0] < b[0] ? 1 : -1))
		.map(([ym, list]) => {
			const byDay = new Map<string, Expense[]>();
			for (const e of list) {
				const day = e.expenseDate;
				const d = byDay.get(day);
				if (d) d.push(e);
				else byDay.set(day, [e]);
			}
			const days: DayGroup[] = [...byDay.entries()]
				.sort((a, b) => (a[0] < b[0] ? 1 : -1))
				.map(([day, dl]) => ({
					day,
					total: sumLocal(dl),
					items: [...dl].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
				}));
			return { ym, total: sumLocal(list), days };
		});
}

function sumLocal(list: Expense[]): number {
	return list.reduce((s, e) => s + e.localAmount, 0);
}

function formatMonth(ym: string): string {
	const [y, m] = ym.split("-").map(Number);
	if (!y || !m) return ym;
	return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
		month: "long",
		year: "numeric",
	});
}

function formatDayLabel(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString("en-GB", {
		weekday: "short",
		day: "2-digit",
		month: "short",
	});
}
