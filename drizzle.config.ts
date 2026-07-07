import process from "node:process";
import { defineConfig } from "drizzle-kit";

// Migrations run as the admin (postgres) connection so tables are owned by
// postgres — that keeps RLS effective for the app's petty_app role.
export default defineConfig({
	schema: "./src/lib/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.ADMIN_DATABASE_URL ??
			process.env.DATABASE_URL ??
			"postgresql://postgres:postgres@localhost:5432/petty_cash",
	},
});
