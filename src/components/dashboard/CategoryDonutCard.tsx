import {
	CHART_COLORS,
	DonutChart,
	DonutLegend,
} from "#/components/charts/DonutChart";
import { EmptyState, SectionCard } from "#/components/ui/primitives";
import { spendByCategory } from "#/lib/calc";
import { usdToLocal } from "#/lib/currency/exchangeRate";
import { formatMoney, formatUsd } from "#/lib/format";
import type { Category, CurrencyCode, Expense } from "#/lib/types";

// Expense-by-category donut + legend. HQ views show USD; branch views pass
// displayCurrency to show local amounts (proportions are identical).
export function CategoryDonutCard({
	expenses,
	categories,
	title = "Expense by category",
	displayCurrency,
	displayRate,
}: {
	expenses: Expense[];
	categories: Category[];
	title?: string;
	displayCurrency?: CurrencyCode;
	displayRate?: number;
}) {
	const isLocal = displayCurrency != null && displayCurrency !== "USD";
	const fmt = (usd: number) =>
		isLocal
			? formatMoney(usdToLocal(usd, displayRate ?? 1), displayCurrency)
			: formatUsd(usd);
	const slices = spendByCategory(expenses, categories).map((s, i) => ({
		label: s.label,
		value: s.usd,
		color: CHART_COLORS[i % CHART_COLORS.length] as string,
	}));
	const total = slices.reduce((sum, s) => sum + s.value, 0);

	return (
		<SectionCard title={title}>
			{slices.length === 0 ? (
				<EmptyState
					title="No spending yet"
					description="Submitted expenses will break down by category here."
				/>
			) : (
				<div className="@container">
					<div className="flex flex-col items-center gap-6 @md:flex-row @md:items-center">
						<DonutChart
							slices={slices}
							centerValue={fmt(total)}
							centerLabel="total"
						/>
						<div className="w-full min-w-0 flex-1">
							<DonutLegend slices={slices} total={total} formatValue={fmt} />
						</div>
					</div>
				</div>
			)}
		</SectionCard>
	);
}
