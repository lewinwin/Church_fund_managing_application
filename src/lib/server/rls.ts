// Runs a unit of work inside a transaction that sets the per-request RLS
// session vars, so Postgres policies scope every query to the caller's branch.
// Server-only.
import { sql } from "drizzle-orm";
import { db } from "#/lib/db/client";

export type Role = "hq_admin" | "branch_user";

export interface AuthCtx {
	userId: string;
	role: Role;
	branchId: string | null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withRls<T>(
	ctx: AuthCtx,
	fn: (tx: Tx) => Promise<T>,
): Promise<T> {
	return db.transaction(async (tx) => {
		const isHq = ctx.role === "hq_admin" ? "true" : "false";
		// set_config(name, value, is_local=true) === SET LOCAL (tx-scoped).
		await tx.execute(sql`select set_config('app.is_hq', ${isHq}, true)`);
		await tx.execute(
			sql`select set_config('app.branch_id', ${ctx.branchId ?? ""}, true)`,
		);
		return fn(tx);
	});
}
