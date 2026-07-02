import { Link, useRouterState } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { cx } from "#/components/ui/primitives";
import type { Role } from "#/lib/types";
import { navForRole } from "./nav";

export function Sidebar({
	role,
	roleLabel,
	onNavigate,
}: {
	role: Role;
	roleLabel: string;
	onNavigate?: () => void;
}) {
	const items = navForRole(role);
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-white">
			<div className="flex items-center gap-2.5 px-6 py-6">
				<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-forest-800)] text-[var(--color-lime-400)]">
					<Coins size={20} />
				</span>
				<div className="leading-tight">
					<p className="text-sm font-bold tracking-tight">611 Petty Cash</p>
					<p className="text-[11px] text-[var(--color-muted)]">{roleLabel}</p>
				</div>
			</div>

			<nav className="flex-1 space-y-1 px-3 py-2">
				{items.map((item) => {
					const active =
						pathname === item.to || pathname.startsWith(`${item.to}/`);
					const Icon = item.icon;
					return (
						<Link
							key={item.to}
							to={item.to}
							onClick={onNavigate}
							className={cx(
								"flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
								active
									? "bg-[var(--color-lime-100)] text-[var(--color-forest-900)]"
									: "text-[var(--color-muted)] hover:bg-[var(--color-forest-50)] hover:text-[var(--color-forest-800)]",
							)}
						>
							<Icon size={18} className="shrink-0" />
							{item.label}
						</Link>
					);
				})}
			</nav>

			<div className="m-3 rounded-2xl bg-[var(--color-forest-800)] p-4 text-white">
				<p className="text-sm font-semibold">Week 1 Prototype</p>
				<p className="mt-1 text-xs text-[var(--color-forest-100)]">
					Running on mock data in your browser. Reset anytime from Settings.
				</p>
			</div>
		</aside>
	);
}
