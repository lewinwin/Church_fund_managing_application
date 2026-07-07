// Seed the real auth accounts through Better Auth (hashes passwords into the
// `account` table), then set each user's role + branchId. Idempotent-ish:
// wipes the auth tables first.
//
//   bun run db:seed:users
import process from "node:process";
import { eq } from "drizzle-orm";
import { buildSeedData } from "../src/data/seed";
import { auth } from "../src/lib/auth/server";
import { db } from "../src/lib/db/client";
import * as s from "../src/lib/db/schema";

async function main() {
	const { users } = buildSeedData();

	// Fresh start for auth tables (children first).
	await db.delete(s.session);
	await db.delete(s.account);
	await db.delete(s.user);

	for (const u of users) {
		await auth.api.signUpEmail({
			body: { email: u.email, password: u.password, name: u.name },
		});
		await db
			.update(s.user)
			.set({ role: u.role, branchId: u.branchId })
			.where(eq(s.user.email, u.email));
		console.log(`  ✓ ${u.email.padEnd(26)} ${u.role}  ${u.branchId ?? ""}`);
	}

	// Verify one sign-in end-to-end.
	const check = await auth.api.signInEmail({
		body: { email: "singapore@example.com", password: "demo123" },
	});
	console.log(
		`\nSign-in check: ${check.user.email} → role=${(check.user as { role?: string }).role}, branchId=${(check.user as { branchId?: string }).branchId}`,
	);

	console.log(`\nSeeded ${users.length} accounts.`);
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
