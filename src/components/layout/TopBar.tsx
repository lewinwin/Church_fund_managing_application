import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useState } from "react";
import { Avatar } from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { initials } from "#/lib/format";
import type { Branch } from "#/lib/types";

export function TopBar({
	title,
	branch,
	onMenu,
}: {
	title: string;
	branch: Branch | null;
	onMenu?: () => void;
}) {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [menuOpen, setMenuOpen] = useState(false);

	function handleLogout() {
		logout();
		navigate({ to: "/login" });
	}

	return (
		<header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-canvas)]/80 px-4 py-3 backdrop-blur md:px-6">
			<button
				type="button"
				onClick={onMenu}
				className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-white md:hidden"
			>
				<Menu size={20} />
			</button>

			<div className="min-w-0 flex-1">
				<h1 className="truncate text-lg font-bold tracking-tight text-[var(--color-ink)]">
					{title}
				</h1>
				<p className="truncate text-xs text-[var(--color-muted)]">
					{branch
						? `${branch.name} · ${branch.localCurrency}`
						: "Headquarters · all branches"}
				</p>
			</div>

			<div className="relative hidden items-center lg:flex">
				<Search
					size={16}
					className="absolute left-3 text-[var(--color-muted)]"
				/>
				<input
					className="field-input w-56 pl-9"
					placeholder="Search…"
					aria-label="Search"
				/>
			</div>

			<button
				type="button"
				className="relative rounded-xl border border-[var(--color-line)] bg-white p-2.5 text-[var(--color-muted)] hover:text-[var(--color-forest-800)]"
				aria-label="Notifications"
			>
				<Bell size={18} />
				<span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--color-negative)]" />
			</button>

			<div className="relative">
				<button
					type="button"
					onClick={() => setMenuOpen((v) => !v)}
					className="flex items-center gap-2.5 rounded-xl border border-[var(--color-line)] bg-white py-1.5 pl-1.5 pr-3"
				>
					<Avatar label={initials(user?.name ?? "?")} size={30} />
					<span className="hidden text-sm font-semibold sm:inline">
						{user?.name}
					</span>
				</button>
				{menuOpen && (
					<>
						<button
							type="button"
							aria-label="Close menu"
							className="fixed inset-0 z-10"
							onClick={() => setMenuOpen(false)}
						/>
						<div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-lg">
							<div className="border-b border-[var(--color-line)] px-4 py-3">
								<p className="text-sm font-semibold">{user?.name}</p>
								<p className="truncate text-xs text-[var(--color-muted)]">
									{user?.email}
								</p>
							</div>
							<button
								type="button"
								onClick={handleLogout}
								className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[var(--color-negative)] hover:bg-[var(--color-forest-50)]"
							>
								<LogOut size={16} />
								Log out
							</button>
						</div>
					</>
				)}
			</div>
		</header>
	);
}
