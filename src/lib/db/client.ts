// App runtime DB client. Connects as the limited `petty_app` role so that
// Row-Level Security actually restricts it (the tables are owned by postgres,
// which is used only for migrations/seed). Server-only module.
import process from "node:process";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
	throw new Error("DATABASE_URL is not set (see .env)");
}

export const sql = postgres(url, { max: 10 });
export const db = drizzle(sql, { schema });
