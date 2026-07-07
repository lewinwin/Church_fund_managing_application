// Sanity-check the data-access layer through the app's petty_app connection.
//   bun scripts/verify-data.ts
import process from "node:process";
import { sql } from "../src/lib/db/client";
import { getBootstrapData } from "../src/lib/server/data";

async function main() {
	const sg = await getBootstrapData({
		userId: "u-sg",
		role: "branch_user",
		branchId: "br-sg",
	});
	console.log(
		`Singapore branch_user  → expenses=${sg.expenses.length}, plans=${sg.fundingPlans.length}, releases=${sg.fundReleases.length}, users=${sg.users.length}, branchIds=[${[...new Set(sg.expenses.map((e) => e.branchId))].join(",")}]`,
	);

	const hq = await getBootstrapData({
		userId: "u-hq",
		role: "hq_admin",
		branchId: null,
	});
	console.log(
		`HQ admin               → expenses=${hq.expenses.length}, plans=${hq.fundingPlans.length}, releases=${hq.fundReleases.length}, users=${hq.users.length}, branches=${hq.branches.length}`,
	);

	await sql.end();
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
