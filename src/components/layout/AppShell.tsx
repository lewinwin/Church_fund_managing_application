import {
	Link,
	Outlet,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "#/lib/auth/auth";
import { branchById } from "#/lib/calc";
import { useStore } from "#/lib/store/store";
import type { Role } from "#/lib/types";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

// Route access rules mirror the sidebar. Guards below enforce them so a
// hand-typed URL can't cross the role boundary.
const HQ_ONLY = ["/branches", "/funding-plans", "/categories", "/users"];
const BRANCH_ONLY = ["/submit-receipt", "/expenses"];

function isHqOnly(path: string) {
	return HQ_ONLY.some((p) => path === p || path.startsWith(`${p}/`));
}
function isBranchOnly(path: string) {
	return BRANCH_ONLY.some((p) => path === p || path.startsWith(`${p}/`));
}

function pageTitle(path: string, role: Role, branchName?: string): string {
	if (path === "/dashboard")
		return role === "hq_admin" ? "HQ Dashboard" : "Dashboard";
	if (path.startsWith("/branches/") && branchName)
		return `${branchName} — Branch Detail`;
	if (path === "/branches") return "Branches";
	if (path === "/funding-plans") return "Funding Plans";
	if (path === "/categories") return "Categories";
	if (path === "/users") return "Users & Accounts";
	if (path === "/reports") return "Reports & Export";
	if (path === "/settings") return "Settings";
	if (path === "/submit-receipt") return "Upload Receipt";
	if (path === "/expenses") return "My Receipts";
	return "611 Ministry Funding";
}

function FullScreenLoader() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]">
			<div className="flex flex-col items-center gap-3 text-[var(--color-muted)]">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-forest-200)] border-t-[var(--color-forest-700)]" />
				<p className="text-sm">Loading…</p>
			</div>
		</div>
	);
}

export function AppShell() {
	const { user, ready } = useAuth();
	const { hydrated, data } = useStore();
	const navigate = useNavigate();
	const [mobileOpen, setMobileOpen] = useState(false);
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	// Auth + role guards.
	useEffect(() => {
		if (!ready) return;
		if (!user) {
			navigate({ to: "/login" });
			return;
		}
		if (user.role === "branch_user" && isHqOnly(pathname)) {
			navigate({ to: "/dashboard" });
		}
		if (user.role === "hq_admin" && isBranchOnly(pathname)) {
			navigate({ to: "/branches" });
		}
	}, [ready, user, pathname, navigate]);

	if (!ready || !hydrated || !user) return <FullScreenLoader />;

	const branch = branchById(data.branches, user.branchId);
	const branchIdInPath = pathname.startsWith("/branches/")
		? pathname.split("/")[2]
		: undefined;
	const detailBranch = branchIdInPath
		? branchById(data.branches, branchIdInPath)
		: undefined;
	const roleLabel = user.role === "hq_admin" ? "HQ Admin" : "Branch User";

	return (
		<div className="flex min-h-screen bg-[var(--color-canvas)]">
			{/* Desktop sidebar */}
			<div className="hidden md:block">
				<div className="sticky top-0 h-screen">
					<Sidebar role={user.role} roleLabel={roleLabel} />
				</div>
			</div>

			{/* Mobile sidebar */}
			{mobileOpen && (
				<div className="fixed inset-0 z-50 md:hidden">
					<button
						type="button"
						aria-label="Close navigation"
						className="absolute inset-0 bg-[rgba(18,53,43,0.4)]"
						onClick={() => setMobileOpen(false)}
					/>
					<div className="absolute left-0 top-0 h-full">
						<Sidebar
							role={user.role}
							roleLabel={roleLabel}
							onNavigate={() => setMobileOpen(false)}
						/>
					</div>
				</div>
			)}

			<div className="flex min-w-0 flex-1 flex-col">
				<TopBar
					title={pageTitle(pathname, user.role, detailBranch?.name)}
					branch={branch ?? null}
					onMenu={() => setMobileOpen(true)}
				/>
				<main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
					<Outlet />
				</main>
			</div>

			{/* Mobile-only quick-add for branch users → Upload Receipt page.
			    Hidden on desktop (md+) where the sidebar link is used instead. */}
			{user.role === "branch_user" && pathname !== "/submit-receipt" && (
				<Link
					to="/submit-receipt"
					aria-label="Upload receipt"
					className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-forest-800)] text-white shadow-lg transition-transform active:scale-95 md:hidden"
				>
					<Plus size={26} />
				</Link>
			)}
		</div>
	);
}
