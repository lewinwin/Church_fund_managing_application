import type { ReactNode } from "react";
import { Card, cx, ProgressBar, StatusPill } from "#/components/ui/primitives";
import { formatAmount, formatPercent } from "#/lib/format";
import type { BalanceStatus, CurrencyCode } from "#/lib/types";

// Released / Spent / Remaining with a usage bar, in the branch's local currency.
// The currency code is shown once (next to the title) so the three values stay
// symbol-free and never collide on narrow screens.
export function FundOverview({
	title,
	released,
	spent,
	remaining,
	percentUsed,
	status,
	localLine,
	currency,
}: {
	title: string;
	released: number;
	spent: number;
	remaining: number;
	percentUsed: number;
	status?: BalanceStatus;
	localLine?: string;
	currency: CurrencyCode;
}) {
	const barTone =
		status === "low" ? "red" : status === "warning" ? "amber" : "forest";

	const amt = (n: number) => formatAmount(n, currency);

	return (
		<Card className="p-5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<h3 className="text-base font-semibold">{title}</h3>
					<span className="shrink-0 rounded-md bg-[var(--color-forest-50)] px-1.5 py-0.5 text-xs font-semibold text-[var(--color-forest-700)]">
						{currency}
					</span>
				</div>
				{status && <StatusPill status={status} />}
			</div>

			<div className="mt-4 grid grid-cols-3 gap-2">
				<Metric label="Released" value={amt(released)} tone="ink" />
				<Metric label="Spent" value={amt(spent)} tone="red" />
				<Metric label="Remaining" value={amt(remaining)} tone="green" />
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

function Metric({
	label,
	value,
	tone,
}: {
	label: string;
	value: ReactNode;
	tone: "ink" | "red" | "green";
}) {
	const dot =
		tone === "red"
			? "bg-[var(--color-negative)]"
			: tone === "green"
				? "bg-[var(--color-positive)]"
				: "bg-[var(--color-forest-600)]";
	const text =
		tone === "red"
			? "text-[var(--color-negative)]"
			: tone === "green"
				? "text-[var(--color-positive)]"
				: "text-[var(--color-ink)]";
	return (
		<div className="min-w-0">
			<div className="flex items-center gap-1.5">
				<span className={cx("h-2 w-2 shrink-0 rounded-full", dot)} />
				<span className="truncate text-xs text-[var(--color-muted)]">
					{label}
				</span>
			</div>
			<p
				className={cx(
					"mt-1 truncate text-base font-bold tabular-nums sm:text-lg",
					text,
				)}
			>
				{value}
			</p>
		</div>
	);
}
