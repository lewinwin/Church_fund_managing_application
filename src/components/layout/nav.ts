// Role-based navigation definitions. Users never see links they can't access.
import {
	FileBarChart,
	FolderTree,
	LayoutDashboard,
	type LucideIcon,
	Receipt,
	Settings,
	Upload,
	Users,
	Wallet,
} from "lucide-react";
import type { Role } from "#/lib/types";

export interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
}

const BRANCH_NAV: NavItem[] = [
	{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ to: "/submit-receipt", label: "Upload Receipt", icon: Upload },
	{ to: "/expenses", label: "My Receipts", icon: Receipt },
	{ to: "/reports", label: "Reports", icon: FileBarChart },
	{ to: "/settings", label: "Settings", icon: Settings },
];

const HQ_NAV: NavItem[] = [
	{ to: "/dashboard", label: "HQ Dashboard", icon: LayoutDashboard },
	{ to: "/branches", label: "Branches", icon: FolderTree },
	{ to: "/funding-plans", label: "Funding Plans", icon: Wallet },
	{ to: "/categories", label: "Categories", icon: Receipt },
	{ to: "/reports", label: "Reports", icon: FileBarChart },
	{ to: "/users", label: "Users", icon: Users },
	{ to: "/settings", label: "Settings", icon: Settings },
];

export function navForRole(role: Role): NavItem[] {
	return role === "hq_admin" ? HQ_NAV : BRANCH_NAV;
}
