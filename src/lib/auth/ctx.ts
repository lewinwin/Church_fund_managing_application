// Resolve the authenticated caller (from the Better Auth session cookie) into
// the AuthCtx the data layer needs. Server-only.
import { getRequest } from "@tanstack/react-start/server";
import type { AuthCtx, Role } from "#/lib/server/rls";
import { auth } from "./server";

export async function getAuthCtx(): Promise<AuthCtx | null> {
	const session = await auth.api.getSession({ headers: getRequest().headers });
	if (!session?.user) return null;
	const u = session.user as {
		id: string;
		role?: string;
		branchId?: string | null;
	};
	return {
		userId: u.id,
		role: (u.role ?? "branch_user") as Role,
		branchId: u.branchId ?? null,
	};
}

export async function requireAuthCtx(): Promise<AuthCtx> {
	const ctx = await getAuthCtx();
	if (!ctx) throw new Error("Not authenticated");
	return ctx;
}
