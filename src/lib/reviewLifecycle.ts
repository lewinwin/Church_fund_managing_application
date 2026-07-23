// The review lifecycle: the single home for "what can happen to an Expense in a
// given review status, and who may do it." Pure — no DB, no I/O — so the whole
// state machine is legible and testable in one place (reviewLifecycle.test.ts).
//
// Everything that used to re-derive these rules — the data-layer transitions,
// the HQ decision buttons, the branch correction button, the flag markers, the
// Needs-Check queue filter — now asks this module instead. A new rule (a
// modify-loop cap, an override marker) is an edit to the TRANSITIONS table here,
// not a sweep across six components.
//
// OCR comparison (reading a receipt) is a different concern and stays in
// verify.ts; the routing of a verify *result* into a status lives here, since
// that is part of the lifecycle.
import type { ReviewStatus } from "#/lib/types";

/** A human decision that moves an Expense through review. */
export type ReviewAction = "cancel" | "modify" | "correct" | "edit";

/** Who is acting. Branch actions are additionally owner-scoped by the caller. */
export type Actor = "hq_admin" | "branch_user";

interface Transition {
	action: ReviewAction;
	actor: Actor;
	from: ReviewStatus[];
	/** Fixed next status, or a function of the source status. */
	to: ReviewStatus | ((from: ReviewStatus) => ReviewStatus);
	/** Whether this transition increments the Expense's modify counter. */
	bumpModifyCount?: boolean;
}

// The entire state machine, declaratively. Read top-to-bottom: this IS the spec.
const TRANSITIONS: Transition[] = [
	// HQ's decision outranks OCR, so Correct is available on any flagged item.
	// After a modify round it confirms the correction; on a first-pass flag it
	// approves the entry as-is (back to normal).
	{
		action: "correct",
		actor: "hq_admin",
		from: ["need_check", "after_modify_check"],
		to: (from) =>
			from === "after_modify_check" ? "correct_modification" : "ok",
	},
	// Return a flagged item to the branch to fix (typed fields only).
	{
		action: "modify",
		actor: "hq_admin",
		from: ["need_check", "after_modify_check"],
		to: "modify_requested",
		bumpModifyCount: true,
	},
	// Reject a flagged item — retained but excluded from balances.
	{
		action: "cancel",
		actor: "hq_admin",
		from: ["need_check", "after_modify_check"],
		to: "cancelled",
	},
	// The owning branch corrects a returned item; it re-enters verification.
	{
		action: "edit",
		actor: "branch_user",
		from: ["modify_requested"],
		to: "checking",
	},
];

function transitionFor(
	status: ReviewStatus,
	action: ReviewAction,
	actor: Actor,
): Transition | undefined {
	return TRANSITIONS.find(
		(t) => t.action === action && t.actor === actor && t.from.includes(status),
	);
}

/** The actions `actor` may take on an Expense in `status` — drives which buttons
 *  the UI renders, so a button can never appear that the server would reject. */
export function availableActions(
	status: ReviewStatus,
	actor: Actor,
): ReviewAction[] {
	return TRANSITIONS.filter(
		(t) => t.actor === actor && t.from.includes(status),
	).map((t) => t.action);
}

export type ApplyResult =
	| { next: ReviewStatus; bumpModifyCount: boolean }
	| { rejected: string };

/** Apply a decision. Returns the next status (+ whether to bump the modify
 *  count), or a rejection with a reason — the single guard for every transition. */
export function applyAction(
	status: ReviewStatus,
	action: ReviewAction,
	actor: Actor,
): ApplyResult {
	const t = transitionFor(status, action, actor);
	if (!t) {
		return { rejected: `Cannot ${action} from status "${status}"` };
	}
	const next = typeof t.to === "function" ? t.to(status) : t.to;
	return { next, bumpModifyCount: t.bumpModifyCount === true };
}

/** True once an Expense has reached a state that needs no further action from
 *  anyone. Used to decide whether HQ still sees the review panel. */
export function isResolved(status: ReviewStatus): boolean {
	return (
		status === "ok" ||
		status === "cancelled" ||
		status === "correct_modification"
	);
}

/** True while some actor still has to act (HQ to review, or the branch to
 *  correct). Drives the month/day flag markers and counts. `checking` is
 *  transient (OCR running) and not counted. */
export function needsAction(status: ReviewStatus): boolean {
	return (
		availableActions(status, "hq_admin").length > 0 ||
		availableActions(status, "branch_user").length > 0
	);
}

/** Where a transaction lands after a verify pass. A first-pass check (modifyCount
 *  0) resolves to ok/need_check; any re-check after HQ requested a modify always
 *  routes back to HQ as `after_modify_check` (HQ decides via the buttons). */
export function nextStatusAfterVerify(
	modifyCount: number,
	needsCheck: boolean,
): ReviewStatus {
	if (modifyCount > 0) return "after_modify_check";
	return needsCheck ? "need_check" : "ok";
}
