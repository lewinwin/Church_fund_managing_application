import { createFileRoute } from "@tanstack/react-router";
import { BranchDashboard } from "#/components/dashboard/BranchDashboard";
import { HqDashboard } from "#/components/dashboard/HqDashboard";
import { EmptyState } from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { branchById } from "#/lib/calc";
import { useStore } from "#/lib/store/store";

export const Route = createFileRoute("/_app/dashboard")({
	component: DashboardPage,
});

// Role-aware: HQ Admin sees the consolidated view; Branch Users see their own.
function DashboardPage() {
	const { user } = useAuth();
	const { data } = useStore();
	if (!user) return null;

	if (user.role === "hq_admin") return <HqDashboard />;

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
