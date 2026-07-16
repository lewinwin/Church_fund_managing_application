import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "#/lib/auth/auth";

export const Route = createFileRoute("/")({ component: Index });

// Entry point: HQ lands on Branches (no dashboard), branch users on their
// dashboard; signed-out users go to login.
function Index() {
	const { user, ready } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (!ready) return;
		navigate({
			to: !user
				? "/login"
				: user.role === "hq_admin"
					? "/branches"
					: "/dashboard",
		});
	}, [ready, user, navigate]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]">
			<div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-forest-200)] border-t-[var(--color-forest-700)]" />
		</div>
	);
}
