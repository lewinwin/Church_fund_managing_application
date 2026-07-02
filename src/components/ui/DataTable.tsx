// Minimal generic data table. Columns describe header + cell render.
import type { ReactNode } from "react";
import { cx } from "./primitives";

export interface Column<T> {
	key: string;
	header: ReactNode;
	render: (row: T) => ReactNode;
	align?: "left" | "right" | "center";
	className?: string;
}

export function DataTable<T>({
	columns,
	rows,
	getKey,
	onRowClick,
	empty,
}: {
	columns: Column<T>[];
	rows: T[];
	getKey: (row: T) => string;
	onRowClick?: (row: T) => void;
	empty?: ReactNode;
}) {
	const alignClass = (a?: "left" | "right" | "center") =>
		a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

	if (rows.length === 0 && empty) {
		return <div>{empty}</div>;
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b border-[var(--color-line)]">
						{columns.map((c) => (
							<th
								key={c.key}
								className={cx(
									"whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]",
									alignClass(c.align),
								)}
							>
								{c.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr
							key={getKey(row)}
							onClick={onRowClick ? () => onRowClick(row) : undefined}
							className={cx(
								"border-b border-[var(--color-line)] last:border-0",
								onRowClick &&
									"cursor-pointer transition-colors hover:bg-[var(--color-forest-50)]",
							)}
						>
							{columns.map((c) => (
								<td
									key={c.key}
									className={cx(
										"whitespace-nowrap px-3 py-3 text-[var(--color-ink)]",
										alignClass(c.align),
										c.className,
									)}
								>
									{c.render(row)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
