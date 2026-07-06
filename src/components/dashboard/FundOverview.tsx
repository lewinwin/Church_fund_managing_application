import { Card, ProgressBar, StatusPill } from "#/components/ui/primitives";
import { usdToLocal } from "#/lib/currency/exchangeRate";
import { formatMoney, formatPercent, formatUsd } from "#/lib/format";
import type { BalanceStatus, CurrencyCode } from "#/lib/types";

// Released / Spent / Remaining with a usage bar. Reused across the branch
// dashboard, HQ dashboard and branch detail. HQ views leave displayCurrency
// unset (USD); branch views pass their local currency to show local figures.
export function FundOverview({
	title,
	releasedUsd,
	spentUsd,
	remainingUsd,
	percentUsed,
	status,
	localLine,
	displayCurrency,
}: {
	title: string;
	releasedUsd: number;
	spentUsd: number;
	remainingUsd: number;
	percentUsed: number;
	status?: BalanceStatus;
	localLine?: string;
	displayCurrency?: CurrencyCode;
}) {
	const barTone =
		status === "low" ? "red" : status === "warning" ? "amber" : "forest";

	const isLocal = displayCurrency != null && displayCurrency !== "USD";
	const fmt = (usd: number) =>
		isLocal
			? formatMoney(usdToLocal(usd, displayCurrency), displayCurrency)
			: formatUsd(usd);

	return (
		<Card className="p-5">
			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold">{title}</h3>
				{status && <StatusPill status={status} />}
			</div>

			<div className="mt-4 grid grid-cols-3 gap-3">
				<div>
					<p className="text-xs text-[var(--color-muted)]">Released</p>
					<p className="mt-1 text-lg font-bold">{fmt(releasedUsd)}</p>
				</div>
				<div>
					<p className="text-xs text-[var(--color-muted)]">Spent</p>
					<p className="mt-1 text-lg font-bold text-[var(--color-negative)]">
						{fmt(spentUsd)}
					</p>
				</div>
				<div>
					<p className="text-xs text-[var(--color-muted)]">Remaining</p>
					<p className="mt-1 text-lg font-bold text-[var(--color-positive)]">
						{fmt(remainingUsd)}
					</p>
				</div>
			</div>

			<div className="mt-4">
				<div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-muted)]">
					<span>Fund usage</span>
					<span className="font-semibold text-[var(--color-ink)]">
						{formatPercent(percentUsed)} used
					</span>
				</div>
				<ProgressBar value={percentUsed} tone={barTone} />
			</div>

			{localLine && (
				<p className="mt-3 rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
					{localLine}
				</p>
			)}
		</Card>
	);
}
