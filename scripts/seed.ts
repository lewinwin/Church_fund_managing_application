// Seed the domain tables from the existing JSON (same data as W1's localStorage
// prototype). Runs as the admin connection. Auth users are seeded separately
// (scripts/seed-users.ts) via Better Auth so passwords are hashed correctly.
//
//   bun run db:seed
import process from "node:process";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buildSeedData } from "../src/data/seed";
import * as s from "../src/lib/db/schema";

const url = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("ADMIN_DATABASE_URL / DATABASE_URL not set (see .env)");

const sql = postgres(url, { max: 1 });
const db = drizzle(sql, { schema: s });

async function main() {
	const data = buildSeedData();

	// Clear domain tables (children first to respect FKs).
	await db.delete(s.expenses);
	await db.delete(s.fundReleases);
	await db.delete(s.fundingPlans);
	await db.delete(s.expenseCategories);
	await db.delete(s.branches);

	await db.insert(s.branches).values(
		data.branches.map((b) => ({
			id: b.id,
			name: b.name,
			country: b.country,
			localCurrency: b.localCurrency,
			exchangeRateToUsd: b.exchangeRateToUsd,
			createdAt: new Date(b.createdAt),
		})),
	);

	await db.insert(s.expenseCategories).values(
		data.categories.map((c) => ({
			id: c.id,
			name: c.name,
			parentId: c.parentId,
			active: c.active,
			createdAt: new Date(c.createdAt),
		})),
	);

	await db.insert(s.fundingPlans).values(
		data.fundingPlans.map((p) => ({
			id: p.id,
			branchId: p.branchId,
			totalTargetUsd: p.totalTargetUsd,
			description: p.description,
			status: p.status,
			createdAt: new Date(p.createdAt),
		})),
	);

	await db.insert(s.fundReleases).values(
		data.fundReleases.map((r) => ({
			id: r.id,
			fundingPlanId: r.fundingPlanId,
			branchId: r.branchId,
			amountUsd: r.amountUsd,
			releaseDate: r.releaseDate,
			note: r.note,
			createdByUserId: r.createdByUserId,
			createdAt: new Date(r.createdAt),
		})),
	);

	await db.insert(s.expenses).values(
		data.expenses.map((e) => ({
			id: e.id,
			branchId: e.branchId,
			submittedByUserId: e.submittedByUserId,
			description: e.description,
			expenseDate: e.expenseDate,
			localAmount: e.localAmount,
			localCurrency: e.localCurrency,
			exchangeRateToUsd: e.exchangeRateToUsd,
			usdAmount: e.usdAmount,
			categoryId: e.categoryId,
			otherSubcategoryId: e.otherSubcategoryId,
			receiptFileName: e.receiptFileName,
			receiptDataUrl: e.receiptDataUrl,
			ocrConfidence: e.ocrConfidence,
			ocrRaw: e.ocrRaw,
			// Seed expenses are historical/verified — they start as `ok`, not
			// `checking`, so they display normally without an OCR pass.
			reviewStatus: "ok",
			createdAt: new Date(e.createdAt),
		})),
	);

	console.log(
		`Seeded: ${data.branches.length} branches, ${data.categories.length} categories, ` +
			`${data.fundingPlans.length} plans, ${data.fundReleases.length} releases, ` +
			`${data.expenses.length} expenses`,
	);
	await sql.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
