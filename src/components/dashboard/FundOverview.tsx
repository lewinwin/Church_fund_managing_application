import { Card, ProgressBar, StatusPill } from "#/components/ui/primitives";
import { formatPercent, formatUsd } from "#/lib/format";
import type { BalanceStatus } from "#/lib/types";

// Released / Spent / Remaining with a usage bar. Reused across the branch
// dashboard, HQ dashboard and branch detail.
export function FundOverview({
	title,
	releasedUsd,
	spentUsd,
	remainingUsd,
	percentUsed,
	status,
	localLine,
}: {
	title: string;
	releasedUsd: number;
	spentUsd: number;
	remainingUsd: number;
	percentUsed: number;
	status?: BalanceStatus;
	localLine?: string;
}) {
	const barTone =
		status === "low" ? "red" : status === "warning" ? "amber" : "forest";

	return (
		<Card className="p-5">
			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold">{title}</h3>
				{status && <StatusPill status={status} />}
			</div>

			<div className="mt-4 grid grid-cols-3 gap-3">
				<div>
					<p className="text-xs text-[var(--color-muted)]">Released</p>
					<p className="mt-1 text-lg font-bold">{formatUsd(releasedUsd)}</p>
				</div>
				<div>
					<p className="text-xs text-[var(--color-muted)]">Spent</p>
					<p className="mt-1 text-lg font-bold text-[var(--color-negative)]">
						{formatUsd(spentUsd)}
					</p>
				</div>
				<div>
					<p className="text-xs text-[var(--color-muted)]">Remaining</p>
					<p className="mt-1 text-lg font-bold text-[var(--color-positive)]">
						{formatUsd(remainingUsd)}
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
