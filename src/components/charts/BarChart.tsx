// Simple responsive vertical bar chart (SVG). Used for spend-by-branch.
export interface Bar {
	label: string;
	value: number;
}

export function BarChart({
	bars,
	formatValue,
	height = 200,
	color = "#2f7d5b",
}: {
	bars: Bar[];
	formatValue: (value: number) => string;
	height?: number;
	color?: string;
}) {
	const max = Math.max(1, ...bars.map((b) => b.value));
	const plotHeight = height - 34;

	if (bars.length === 0) {
		return (
			<p className="py-8 text-center text-sm text-[var(--color-muted)]">
				No data yet.
			</p>
		);
	}

	return (
		<div className="flex items-end gap-3" style={{ height }}>
			{bars.map((b) => {
				const h = Math.max(4, (b.value / max) * plotHeight);
				return (
					<div
						key={b.label}
						className="group flex flex-1 flex-col items-center justify-end gap-2"
					>
						<span className="text-xs font-semibold text-[var(--color-ink)]">
							{formatValue(b.value)}
						</span>
						<div
							className="w-full max-w-[46px] rounded-t-lg transition-all"
							style={{ height: h, background: color }}
							title={`${b.label}: ${formatValue(b.value)}`}
						/>
						<span className="max-w-full truncate text-xs text-[var(--color-muted)]">
							{b.label}
						</span>
					</div>
				);
			})}
		</div>
	);
}
