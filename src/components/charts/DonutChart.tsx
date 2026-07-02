// Lightweight SVG donut chart. No external chart lib — keeps the prototype
// dependency-free and offline.
import type { ReactNode } from "react";

export interface DonutSlice {
	label: string;
	value: number;
	color: string;
}

export const CHART_COLORS = [
	"#163d2f",
	"#2f7d5b",
	"#86cf3e",
	"#7cbf9d",
	"#bfe88a",
	"#d9a33a",
	"#4c9e77",
	"#b7c4bc",
];

export function DonutChart({
	slices,
	size = 180,
	thickness = 22,
	centerLabel,
	centerValue,
}: {
	slices: DonutSlice[];
	size?: number;
	thickness?: number;
	centerLabel?: string;
	centerValue?: ReactNode;
}) {
	const total = slices.reduce((s, x) => s + x.value, 0);
	const r = (size - thickness) / 2;
	const c = 2 * Math.PI * r;
	const cx = size / 2;
	const cy = size / 2;

	let offset = 0;

	return (
		<div className="relative inline-flex items-center justify-center">
			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
				<title>Donut chart</title>
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="var(--color-forest-50)"
					strokeWidth={thickness}
				/>
				{total > 0 &&
					slices.map((slice) => {
						const frac = slice.value / total;
						const dash = frac * c;
						const el = (
							<circle
								key={slice.label}
								cx={cx}
								cy={cy}
								r={r}
								fill="none"
								stroke={slice.color}
								strokeWidth={thickness}
								strokeDasharray={`${dash} ${c - dash}`}
								strokeDashoffset={-offset}
								strokeLinecap="butt"
								transform={`rotate(-90 ${cx} ${cy})`}
							/>
						);
						offset += dash;
						return el;
					})}
			</svg>
			{(centerLabel || centerValue) && (
				<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
					{centerValue && (
						<span className="text-xl font-bold text-[var(--color-ink)]">
							{centerValue}
						</span>
					)}
					{centerLabel && (
						<span className="text-xs text-[var(--color-muted)]">
							{centerLabel}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

export function DonutLegend({
	slices,
	total,
	formatValue,
}: {
	slices: DonutSlice[];
	total: number;
	formatValue: (value: number) => string;
}) {
	return (
		<ul className="flex flex-col gap-2.5">
			{slices.map((s) => {
				const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
				return (
					<li
						key={s.label}
						className="flex min-w-0 items-center gap-2.5 text-sm"
					>
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{ background: s.color }}
						/>
						<span className="min-w-0 flex-1 truncate text-[var(--color-ink)]">
							{s.label}
						</span>
						<span className="shrink-0 whitespace-nowrap text-[var(--color-muted)]">
							{formatValue(s.value)}
						</span>
						<span className="w-9 shrink-0 text-right font-semibold text-[var(--color-ink)]">
							{pct}%
						</span>
					</li>
				);
			})}
		</ul>
	);
}
