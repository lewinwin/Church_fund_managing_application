import {
	CHART_COLORS,
	DonutChart,
	DonutLegend,
} from "#/components/charts/DonutChart";
import { EmptyState, SectionCard } from "#/components/ui/primitives";
import { spendByCategory } from "#/lib/calc";
import { formatUsd } from "#/lib/format";
import type { Category, Expense } from "#/lib/types";

// Expense-by-category donut + legend. Amounts are always shown in USD.
export function CategoryDonutCard({
	expenses,
	categories,
	title = "Expense by category",
}: {
	expenses: Expense[];
	categories: Category[];
	title?: string;
}) {
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
							centerValue={formatUsd(total)}
							centerLabel="total"
						/>
						<div className="w-full min-w-0 flex-1">
							<DonutLegend
								slices={slices}
								total={total}
								formatValue={formatUsd}
							/>
						</div>
					</div>
				</div>
			)}
		</SectionCard>
	);
}
