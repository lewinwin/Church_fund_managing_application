// UI-only mock store. Holds the demo AppData in memory and mutates it locally —
// no server functions, no database. The useStore() shape is identical to the
// real provider, and review transitions reuse the SAME pure reviewLifecycle
// module, so the UI (and the state machine it drives) behaves exactly as in the
// real app. State resets on refresh — that's fine for a showcase.
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { buildMockData } from "#/lib/mock/mockData";
import type { OcrCheck } from "#/lib/ocrCheck";
import { applyAction, nextStatusAfterVerify } from "#/lib/reviewLifecycle";
import type {
	AppData,
	Category,
	Expense,
	FundingPlan,
	FundRelease,
	Role,
	User,
} from "#/lib/types";

export type NewExpense = Omit<
	Expense,
	| "id"
	| "createdAt"
	| "reviewStatus"
	| "reviewNote"
	| "modifyCount"
	| "ocrCheck"
>;
export type NewFundingPlan = Omit<FundingPlan, "id" | "createdAt">;
export type NewFundRelease = Omit<FundRelease, "id" | "createdAt">;

export interface EditExpenseInput {
	localAmount: number;
	expenseDate: string;
	categoryId: string;
	otherSubcategoryId: string | null;
	description: string;
}

interface StoreContextValue {
	data: AppData;
	hydrated: boolean;
	addExpense: (input: NewExpense) => Promise<string>;
	verifyExpense: (expenseId: string) => Promise<void>;
	cancelExpense: (expenseId: string, note: string | null) => Promise<void>;
	requestModify: (expenseId: string, note: string | null) => Promise<void>;
	confirmModification: (expenseId: string) => Promise<void>;
	editExpense: (expenseId: string, input: EditExpenseInput) => Promise<void>;
	addFundingPlan: (input: NewFundingPlan) => Promise<void>;
	updateFundingPlan: (id: string, patch: Partial<FundingPlan>) => Promise<void>;
	addFundRelease: (input: NewFundRelease) => Promise<void>;
	addCategory: (input: {
		name: string;
		parentId: string | null;
	}) => Promise<void>;
	updateCategory: (id: string, patch: Partial<Category>) => Promise<void>;
	toggleCategoryActive: (id: string) => Promise<void>;
	addUser: (input: {
		name: string;
		email: string;
		role: Role;
		branchId: string | null;
	}) => Promise<void>;
	updateUser: (id: string, patch: Partial<User>) => Promise<void>;
	/** HQ-only in the real app; on this demo build passwords aren't stored, so
	 *  this is a no-op that keeps the UI (Users page reset action) working. */
	resetUserPassword: (userId: string) => Promise<void>;
	addBranch: (input: {
		name: string;
		country: string;
		currencyCode: string;
		exchangeRateToUsd: number;
		loginEmail: string;
		defaultPassword: string;
	}) => Promise<void>;
	addToPlanTarget: (planId: string, amountUsd: number) => Promise<void>;
	changePassword: (
		currentPassword: string,
		newPassword: string,
	) => Promise<{ ok: boolean; error?: string }>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

let counter = 0;
const id = (prefix: string) => `${prefix}-${Date.now()}-${(counter += 1)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function StoreProvider({ children }: { children: ReactNode }) {
	const [data, setData] = useState<AppData>(() => buildMockData());

	// Mutate a single expense by id.
	const patchExpense = useCallback(
		(expenseId: string, fn: (e: Expense) => Expense) => {
			setData((d) => ({
				...d,
				expenses: d.expenses.map((e) => (e.id === expenseId ? fn(e) : e)),
			}));
		},
		[],
	);

	const addExpense = useCallback<StoreContextValue["addExpense"]>(
		async (input) => {
			const newId = id("exp");
			const e: Expense = {
				...input,
				id: newId,
				reviewStatus: "checking",
				reviewNote: null,
				modifyCount: 0,
				ocrCheck: null,
				createdAt: new Date().toISOString(),
			};
			setData((d) => ({ ...d, expenses: [e, ...d.expenses] }));
			return newId;
		},
		[],
	);

	// Simulated OCR verification: a matching read (the interesting mismatched
	// states are pre-seeded). A first pass resolves to `ok`; a re-check after a
	// modify routes to `after_modify_check`, same as the real lifecycle.
	const verifyExpense = useCallback<StoreContextValue["verifyExpense"]>(
		async (expenseId) => {
			patchExpense(expenseId, (e) => {
				const catName =
					data.categories.find((c) => c.id === e.categoryId)?.name ?? null;
				const ocrCheck: OcrCheck = {
					ocrAmount: e.localAmount,
					ocrDate: e.expenseDate,
					ocrCurrency: e.localCurrency,
					ocrCategoryGuess: catName,
					categoryFits: 0.92,
					overallConfidence: 0.9,
					amountMatch: true,
					dateMatch: true,
					categoryOk: true,
					needsCheck: false,
					checkedAt: new Date().toISOString(),
				};
				return {
					...e,
					ocrCheck,
					ocrConfidence: 0.9,
					reviewStatus: nextStatusAfterVerify(e.modifyCount, false),
				};
			});
		},
		[patchExpense, data.categories],
	);

	// The three HQ decisions + the branch edit all go through the pure lifecycle.
	const decide = useCallback(
		(
			expenseId: string,
			action: "cancel" | "modify" | "correct" | "edit",
			actor: "hq_admin" | "branch_user",
			extra: Partial<Expense> = {},
		) => {
			patchExpense(expenseId, (e) => {
				const res = applyAction(e.reviewStatus, action, actor);
				if ("rejected" in res) return e; // no-op on illegal transition
				return {
					...e,
					...extra,
					reviewStatus: res.next,
					modifyCount: res.bumpModifyCount ? e.modifyCount + 1 : e.modifyCount,
				};
			});
		},
		[patchExpense],
	);

	const cancelExpense = useCallback<StoreContextValue["cancelExpense"]>(
		async (expenseId, note) =>
			decide(expenseId, "cancel", "hq_admin", { reviewNote: note }),
		[decide],
	);
	const requestModify = useCallback<StoreContextValue["requestModify"]>(
		async (expenseId, note) =>
			decide(expenseId, "modify", "hq_admin", { reviewNote: note }),
		[decide],
	);
	const confirmModification = useCallback<
		StoreContextValue["confirmModification"]
	>(async (expenseId) => decide(expenseId, "correct", "hq_admin"), [decide]);

	const editExpense = useCallback<StoreContextValue["editExpense"]>(
		async (expenseId, input) => {
			patchExpense(expenseId, (e) => {
				const res = applyAction(e.reviewStatus, "edit", "branch_user");
				if ("rejected" in res) return e;
				return {
					...e,
					localAmount: input.localAmount,
					usdAmount: round2(input.localAmount * e.exchangeRateToUsd),
					expenseDate: input.expenseDate,
					categoryId: input.categoryId,
					otherSubcategoryId: input.otherSubcategoryId,
					description: input.description,
					reviewStatus: res.next,
				};
			});
		},
		[patchExpense],
	);

	const addFundingPlan = useCallback<StoreContextValue["addFundingPlan"]>(
		async (input) => {
			const p: FundingPlan = {
				...input,
				id: id("fp"),
				createdAt: new Date().toISOString(),
			};
			setData((d) => ({ ...d, fundingPlans: [...d.fundingPlans, p] }));
		},
		[],
	);
	const updateFundingPlan = useCallback<StoreContextValue["updateFundingPlan"]>(
		async (planId, patch) => {
			setData((d) => ({
				...d,
				fundingPlans: d.fundingPlans.map((p) =>
					p.id === planId ? { ...p, ...patch } : p,
				),
			}));
		},
		[],
	);
	const addToPlanTarget = useCallback<StoreContextValue["addToPlanTarget"]>(
		async (planId, amountUsd) => {
			setData((d) => ({
				...d,
				fundingPlans: d.fundingPlans.map((p) =>
					p.id === planId
						? { ...p, totalTargetUsd: round2(p.totalTargetUsd + amountUsd) }
						: p,
				),
			}));
		},
		[],
	);
	const addFundRelease = useCallback<StoreContextValue["addFundRelease"]>(
		async (input) => {
			const r: FundRelease = {
				...input,
				id: id("fr"),
				createdAt: new Date().toISOString(),
			};
			setData((d) => ({ ...d, fundReleases: [...d.fundReleases, r] }));
		},
		[],
	);

	const addCategory = useCallback<StoreContextValue["addCategory"]>(
		async (input) => {
			const c: Category = {
				id: id(input.parentId ? "sub" : "cat"),
				name: input.name,
				parentId: input.parentId,
				active: true,
				createdAt: new Date().toISOString(),
			};
			setData((d) => ({ ...d, categories: [...d.categories, c] }));
		},
		[],
	);
	const updateCategory = useCallback<StoreContextValue["updateCategory"]>(
		async (catId, patch) => {
			setData((d) => ({
				...d,
				categories: d.categories.map((c) =>
					c.id === catId ? { ...c, ...patch } : c,
				),
			}));
		},
		[],
	);
	const toggleCategoryActive = useCallback<
		StoreContextValue["toggleCategoryActive"]
	>(async (catId) => {
		setData((d) => ({
			...d,
			categories: d.categories.map((c) =>
				c.id === catId ? { ...c, active: !c.active } : c,
			),
		}));
	}, []);

	const addUser = useCallback<StoreContextValue["addUser"]>(async (input) => {
		const u: User = {
			id: id("u"),
			name: input.name,
			email: input.email,
			password: "",
			role: input.role,
			branchId: input.role === "hq_admin" ? null : input.branchId,
			createdAt: new Date().toISOString(),
		};
		setData((d) => ({ ...d, users: [...d.users, u] }));
	}, []);
	const updateUser = useCallback<StoreContextValue["updateUser"]>(
		async (userId, patch) => {
			setData((d) => ({
				...d,
				users: d.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)),
			}));
		},
		[],
	);

	const resetUserPassword = useCallback<
		StoreContextValue["resetUserPassword"]
	>(async () => {
		// Passwords aren't stored on this demo build — nothing to change.
	}, []);

	const addBranch = useCallback<StoreContextValue["addBranch"]>(
		async (input) => {
			const branchId = id("br");
			const branch = {
				id: branchId,
				name: input.name,
				country: input.country,
				localCurrency: input.currencyCode.toUpperCase(),
				exchangeRateToUsd: input.exchangeRateToUsd,
				createdAt: new Date().toISOString(),
			};
			const user: User = {
				id: id("u"),
				name: input.name,
				email: input.loginEmail,
				password: "",
				role: "branch_user",
				branchId,
				createdAt: new Date().toISOString(),
			};
			setData((d) => ({
				...d,
				branches: [...d.branches, branch],
				users: [...d.users, user],
			}));
		},
		[],
	);

	const changePassword = useCallback<StoreContextValue["changePassword"]>(
		async () => ({ ok: true }),
		[],
	);

	const value = useMemo<StoreContextValue>(
		() => ({
			data,
			hydrated: true,
			addExpense,
			verifyExpense,
			cancelExpense,
			requestModify,
			confirmModification,
			editExpense,
			addFundingPlan,
			updateFundingPlan,
			addFundRelease,
			addCategory,
			updateCategory,
			toggleCategoryActive,
			addUser,
			updateUser,
			resetUserPassword,
			addBranch,
			addToPlanTarget,
			changePassword,
		}),
		[
			data,
			addExpense,
			verifyExpense,
			cancelExpense,
			requestModify,
			confirmModification,
			editExpense,
			addFundingPlan,
			updateFundingPlan,
			addFundRelease,
			addCategory,
			updateCategory,
			toggleCategoryActive,
			addUser,
			updateUser,
			resetUserPassword,
			addBranch,
			addToPlanTarget,
			changePassword,
		],
	);

	return (
		<StoreContext.Provider value={value}>{children}</StoreContext.Provider>
	);
}

export function useStore(): StoreContextValue {
	const ctx = useContext(StoreContext);
	if (!ctx) throw new Error("useStore must be used within StoreProvider");
	return ctx;
}
