// Better Auth server instance. Email/password against the Postgres `user`
// table via the Drizzle adapter. `role` + `branchId` are extra user fields
// (set at seed time, not user-editable). Server-only module.
import process from "node:process";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "#/lib/db/client";
import * as schema from "#/lib/db/schema";

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	emailAndPassword: {
		enabled: true,
		// Demo accounts use "demo123" (7 chars); allow it.
		minPasswordLength: 6,
	},
	user: {
		additionalFields: {
			role: { type: "string", required: false, input: false },
			branchId: { type: "string", required: false, input: false },
		},
	},
});
