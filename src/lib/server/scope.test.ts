import { describe, expect, it } from "vitest";
import { expenses } from "#/lib/db/schema";
import { type AuthCtx, branchScope, canWriteBranch } from "./scope";

// Branch isolation is now a pure function, so it's testable without a database.
const hq: AuthCtx = { userId: "u-hq", role: "hq_admin", branchId: null };
const sg: AuthCtx = { userId: "u-sg", role: "branch_user", branchId: "br-sg" };
const mw: AuthCtx = { userId: "u-mw", role: "branch_user", branchId: "br-mw" };

describe("branchScope (read gate)", () => {
	it("applies NO filter for HQ admins — they see every branch", () => {
		expect(branchScope(hq, expenses.branchId)).toBeUndefined();
	});

	it("applies a filter for branch users — scoped to their own branch", () => {
		expect(branchScope(sg, expenses.branchId)).toBeDefined();
		expect(branchScope(mw, expenses.branchId)).toBeDefined();
	});
});

describe("canWriteBranch (write gate)", () => {
	it("lets HQ admins write any branch", () => {
		expect(canWriteBranch(hq, "br-sg")).toBe(true);
		expect(canWriteBranch(hq, "br-mw")).toBe(true);
	});

	it("lets a branch user write ONLY their own branch", () => {
		expect(canWriteBranch(sg, "br-sg")).toBe(true);
		expect(canWriteBranch(sg, "br-mw")).toBe(false);
		expect(canWriteBranch(mw, "br-sg")).toBe(false);
	});
});
