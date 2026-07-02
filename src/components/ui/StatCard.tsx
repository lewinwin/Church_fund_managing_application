// KPI stat tile — icon chip, label, big value, optional delta / sub-line.
import type { ReactNode } from "react";
import { Card, cx } from "./primitives";

export function StatCard({
	label,
	value,
	icon,
	delta,
	sub,
	accent = "forest",
}: {
	label: string;
	value: string;
	icon?: ReactNode;
	delta?: { value: string; positive: boolean };
	sub?: string;
	accent?: "forest" | "lime" | "amber" | "red";
}) {
	const chip: Record<string, string> = {
		forest: "bg-[var(--color-forest-50)] text-[var(--color-forest-600)]",
		lime: "bg-[var(--color-lime-100)] text-[var(--color-forest-700)]",
		amber: "bg-[#fbf1dd] text-[#b7841f]",
		red: "bg-[#fdecea] text-[var(--color-negative)]",
	};
	return (
		<Card className="p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-2.5">
					{icon && (
						<span
							className={cx(
								"flex h-9 w-9 items-center justify-center rounded-xl",
								chip[accent],
							)}
						>
							{icon}
						</span>
					)}
					<span className="text-sm font-medium text-[var(--color-muted)]">
						{label}
					</span>
				</div>
				{delta && (
					<span
						className={cx(
							"rounded-full px-2 py-0.5 text-xs font-semibold",
							delta.positive
								? "bg-[#e4f4ea] text-[var(--color-positive)]"
								: "bg-[#fdecea] text-[var(--color-negative)]",
						)}
					>
						{delta.positive ? "↑" : "↓"} {delta.value}
					</span>
				)}
			</div>
			<div className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-ink)]">
				{value}
			</div>
			{sub && (
				<div className="mt-1 text-xs text-[var(--color-muted)]">{sub}</div>
			)}
		</Card>
	);
}
