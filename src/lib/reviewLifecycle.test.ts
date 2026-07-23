import { describe, expect, it } from "vitest";
import type { ReviewStatus } from "#/lib/types";
import {
	type ReviewAction,
	applyAction,
	availableActions,
	isResolved,
	needsAction,
	nextStatusAfterVerify,
} from "./reviewLifecycle";

const ALL_STATUSES: ReviewStatus[] = [
	"checking",
	"ok",
	"need_check",
	"cancelled",
	"modify_requested",
	"after_modify_check",
	"correct_modification",
];

describe("availableActions", () => {
	it("offers HQ correct/modify/cancel only on flagged states", () => {
		for (const s of ["need_check", "after_modify_check"] as const) {
			expect(availableActions(s, "hq_admin").sort()).toEqual([
				"cancel",
				"correct",
				"modify",
			]);
		}
		for (const s of [
			"ok",
			"checking",
			"cancelled",
			"modify_requested",
			"correct_modification",
		] as const) {
			expect(availableActions(s, "hq_admin")).toEqual([]);
		}
	});

	it("offers the branch edit only on a returned transaction", () => {
		expect(availableActions("modify_requested", "branch_user")).toEqual([
			"edit",
		]);
		for (const s of ALL_STATUSES.filter((s) => s !== "modify_requested")) {
			expect(availableActions(s, "branch_user")).toEqual([]);
		}
	});
});

describe("applyAction", () => {
	it("Correct lands on the right status per source", () => {
		expect(applyAction("need_check", "correct", "hq_admin")).toEqual({
			next: "ok",
			bumpModifyCount: false,
		});
		expect(applyAction("after_modify_check", "correct", "hq_admin")).toEqual({
			next: "correct_modification",
			bumpModifyCount: false,
		});
	});

	it("Modify returns to the branch and bumps the modify count", () => {
		expect(applyAction("need_check", "modify", "hq_admin")).toEqual({
			next: "modify_requested",
			bumpModifyCount: true,
		});
	});

	it("Cancel rejects to cancelled", () => {
		expect(applyAction("after_modify_check", "cancel", "hq_admin")).toEqual({
			next: "cancelled",
			bumpModifyCount: false,
		});
	});

	it("branch edit re-enters verification", () => {
		expect(applyAction("modify_requested", "edit", "branch_user")).toEqual({
			next: "checking",
			bumpModifyCount: false,
		});
	});

	it("rejects illegal transitions with a reason", () => {
		// Correct from cancelled — not allowed.
		const r = applyAction("cancelled", "correct", "hq_admin");
		expect(r).toHaveProperty("rejected");

		// A branch cannot cancel; the wrong actor is not a legal transition.
		expect(applyAction("need_check", "cancel", "branch_user")).toHaveProperty(
			"rejected",
		);

		// HQ cannot edit fields.
		expect(applyAction("modify_requested", "edit", "hq_admin")).toHaveProperty(
			"rejected",
		);
	});

	it("every offered action is applicable (UI never offers an illegal move)", () => {
		for (const status of ALL_STATUSES) {
			for (const actor of ["hq_admin", "branch_user"] as const) {
				for (const action of availableActions(status, actor)) {
					expect(applyAction(status, action, actor)).not.toHaveProperty(
						"rejected",
					);
				}
			}
		}
	});

	it("rejects any action NOT offered for that status+actor", () => {
		const everyAction: ReviewAction[] = ["cancel", "modify", "correct", "edit"];
		for (const status of ALL_STATUSES) {
			for (const actor of ["hq_admin", "branch_user"] as const) {
				const offered = availableActions(status, actor);
				for (const action of everyAction) {
					if (!offered.includes(action)) {
						expect(applyAction(status, action, actor)).toHaveProperty(
							"rejected",
						);
					}
				}
			}
		}
	});
});

describe("isResolved / needsAction", () => {
	it("resolved states need no further action", () => {
		for (const s of ["ok", "cancelled", "correct_modification"] as const) {
			expect(isResolved(s)).toBe(true);
			expect(needsAction(s)).toBe(false);
		}
	});

	it("flagged/returned states still need action; checking is transient", () => {
		for (const s of [
			"need_check",
			"after_modify_check",
			"modify_requested",
		] as const) {
			expect(isResolved(s)).toBe(false);
			expect(needsAction(s)).toBe(true);
		}
		// checking is OCR-in-progress — no human action yet.
		expect(needsAction("checking")).toBe(false);
	});
});

describe("nextStatusAfterVerify", () => {
	it("first pass → ok when clean, need_check when flagged", () => {
		expect(nextStatusAfterVerify(0, false)).toBe("ok");
		expect(nextStatusAfterVerify(0, true)).toBe("need_check");
	});
	it("after a modify round always routes to HQ, regardless of the read", () => {
		expect(nextStatusAfterVerify(1, false)).toBe("after_modify_check");
		expect(nextStatusAfterVerify(2, true)).toBe("after_modify_check");
	});
});
