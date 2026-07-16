import { createFileRoute, Navigate } from "@tanstack/react-router";
import { BranchDashboard } from "#/components/dashboard/BranchDashboard";
import { EmptyState } from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { branchById } from "#/lib/calc";
import { useStore } from "#/lib/store/store";

export const Route = createFileRoute("/_app/dashboard")({
	component: DashboardPage,
});

// Branch users only. HQ no longer has a dashboard — they're redirected to the
// Branches page (the manager considered the HQ dashboard redundant).
function DashboardPage() {
	const { user } = useAuth();
	const { data } = useStore();
	if (!user) return null;

	if (user.role === "hq_admin") return <Navigate to="/branches" />;

	const branch = branchById(data.branches, user.branchId);
	if (!branch) {
		return (
			<EmptyState
				title="No branch assigned"
				description="This account isn't linked to a branch. Contact HQ."
			/>
		);
	}
	return <BranchDashboard branch={branch} />;
}
