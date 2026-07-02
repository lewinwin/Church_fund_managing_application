// Typed loader for the JSON seed files. These are the initial mock records
// hydrated into localStorage on first load (see lib/store).
import type {
	AppData,
	Branch,
	Category,
	Expense,
	FundingPlan,
	FundRelease,
	User,
} from "#/lib/types";
import branches from "./branches.json";
import categories from "./categories.json";
import expenses from "./expenses.json";
import fundingPlans from "./fundingPlans.json";
import users from "./users.json";

const funding = fundingPlans as {
	plans: FundingPlan[];
	releases: FundRelease[];
};

/** Deep clone so mutations never touch the imported seed constants. */
export function buildSeedData(): AppData {
	return structuredClone({
		branches: branches as Branch[],
		users: users as User[],
		categories: categories as Category[],
		expenses: expenses as Expense[],
		fundingPlans: funding.plans,
		fundReleases: funding.releases,
	});
}
