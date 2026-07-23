import {
	CHART_COLORS,
	DonutChart,
	DonutLegend,
} from "#/components/charts/DonutChart";
import { EmptyState, SectionCard } from "#/components/ui/primitives";
import type { CategorySlice } from "#/lib/calc";
import { usdToLocal } from "#/lib/currency/exchangeRate";
import { formatMoney, formatUsd } from "#/lib/format";
import type { CurrencyCode } from "#/lib/types";

// Expense-by-category donut + legend. Presentational: it takes pre-aggregated
// category slices (from the branch ledger, which already excludes cancelled).
// HQ views show USD; branch views pass displayCurrency for local amounts.
export function CategoryDonutCard({
	categorySlices,
	title = "Expense by category",
	displayCurrency,
	displayRate,
}: {
	categorySlices: CategorySlice[];
	title?: string;
	displayCurrency?: CurrencyCode;
	displayRate?: number;
}) {
	const isLocal = displayCurrency != null && displayCurrency !== "USD";
	const fmt = (usd: number) =>
		isLocal
			? formatMoney(usdToLocal(usd, displayRate ?? 1), displayCurrency)
			: formatUsd(usd);
	const slices = categorySlices.map((s, i) => ({
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
