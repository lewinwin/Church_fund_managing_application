// AppData store, now backed by Postgres via server functions. Loads the
// caller's allowed data on login and refetches after each mutation. The
// useStore() shape is unchanged from W1, so components barely change — they
// just observe async loading (gated by `hydrated`).
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useAuth } from "#/lib/auth/auth";
import {
	addToPlanTargetFn,
	bootstrapFn,
	cancelExpenseFn,
	changePasswordFn,
	confirmModificationFn,
	createBranchFn,
	createCategoryFn,
	createFundingPlanFn,
	createUserFn,
	recordFundReleaseFn,
	requestModifyFn,
	resetPasswordFn,
	submitExpenseFn,
	toggleCategoryActiveFn,
	updateCategoryFn,
	updateExpenseFieldsFn,
	updateFundingPlanFn,
	updateUserFn,
	verifyExpenseFn,
} from "#/lib/server/fns";
import type {
	AppData,
	Category,
	Expense,
	FundingPlan,
	FundRelease,
	Role,
	User,
} from "#/lib/types";

// Review fields (reviewStatus/reviewNote/modifyCount) and the OCR check are set
// server-side, so the client never supplies them when submitting.
// The client provides the receipt as a data URL; the server uploads it to object
// storage and persists only the key (receiptKey lives on Expense, not here).
export type NewExpense = Omit<
	Expense,
	| "id"
	| "createdAt"
	| "reviewStatus"
	| "reviewNote"
	| "modifyCount"
	| "ocrCheck"
	| "receiptKey"
> & { receiptDataUrl: string | null };
export type NewFundingPlan = Omit<FundingPlan, "id" | "createdAt">;
export type NewFundRelease = Omit<FundRelease, "id" | "createdAt">;

const EMPTY: AppData = {
	branches: [],
	users: [],
	categories: [],
	expenses: [],
	fundingPlans: [],
	fundReleases: [],
};

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
	/** Submits the expense and returns its new id (so the caller can verify it). */
	addExpense: (input: NewExpense) => Promise<string>;
	/** Runs OCR verification and refreshes; used post-submit and for Re-check. */
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
	/** HQ-only: resets a user's password to the default (demo123). */
	resetUserPassword: (userId: string) => Promise<void>;
	addBranch: (input: {
		name: string;
		country: string;
		currencyCode: string;
		loginEmail: string;
		defaultPassword: string;
	}) => Promise<void>;
	addToPlanTarget: (planId: string, amount: number) => Promise<void>;
	changePassword: (
		currentPassword: string,
		newPassword: string,
	) => Promise<{ ok: boolean; error?: string }>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
	const { user, ready: authReady } = useAuth();
	const [data, setData] = useState<AppData>(EMPTY);
	const [hydrated, setHydrated] = useState(false);

	const refresh = useCallback(async () => {
		if (!user) {
			setData(EMPTY);
			return;
		}
		const next = await bootstrapFn();
		setData(next ?? EMPTY);
	}, [user]);

	// Load (or clear) data whenever the authenticated user changes.
	useEffect(() => {
		if (!authReady) return;
		setHydrated(false);
		refresh().finally(() => setHydrated(true));
	}, [authReady, refresh]);

	const addExpense = useCallback<StoreContextValue["addExpense"]>(
		async (input) => {
			const id = await submitExpenseFn({
				data: {
					description: input.description,
					expenseDate: input.expenseDate,
					localAmount: input.localAmount,
					localCurrency: input.localCurrency,
					categoryId: input.categoryId,
					otherSubcategoryId: input.otherSubcategoryId,
					receiptFileName: input.receiptFileName,
					receiptDataUrl: input.receiptDataUrl,
					ocrConfidence: input.ocrConfidence,
				},
			});
			await refresh();
			return id;
		},
		[refresh],
	);

	const verifyExpense = useCallback<StoreContextValue["verifyExpense"]>(
		async (expenseId) => {
			await verifyExpenseFn({ data: { expenseId } });
			await refresh();
		},
		[refresh],
	);

	const cancelExpense = useCallback<StoreContextValue["cancelExpense"]>(
		async (expenseId, note) => {
			await cancelExpenseFn({ data: { expenseId, note } });
			await refresh();
		},
		[refresh],
	);

	const requestModify = useCallback<StoreContextValue["requestModify"]>(
		async (expenseId, note) => {
			await requestModifyFn({ data: { expenseId, note } });
			await refresh();
		},
		[refresh],
	);

	const confirmModification = useCallback<
		StoreContextValue["confirmModification"]
	>(
		async (expenseId) => {
			await confirmModificationFn({ data: { expenseId } });
			await refresh();
		},
		[refresh],
	);

	const editExpense = useCallback<StoreContextValue["editExpense"]>(
		async (expenseId, input) => {
			await updateExpenseFieldsFn({ data: { expenseId, ...input } });
			await refresh();
		},
		[refresh],
	);

	const addFundingPlan = useCallback<StoreContextValue["addFundingPlan"]>(
		async (input) => {
			await createFundingPlanFn({ data: input });
			await refresh();
		},
		[refresh],
	);

	const updateFundingPlan = useCallback<StoreContextValue["updateFundingPlan"]>(
		async (id, patch) => {
			await updateFundingPlanFn({
				data: {
					id,
					patch: {
						totalTarget: patch.totalTarget,
						description: patch.description,
						status: patch.status,
					},
				},
			});
			await refresh();
		},
		[refresh],
	);

	const addFundRelease = useCallback<StoreContextValue["addFundRelease"]>(
		async (input) => {
			await recordFundReleaseFn({
				data: {
					fundingPlanId: input.fundingPlanId,
					branchId: input.branchId,
					amount: input.amount,
					releaseDate: input.releaseDate,
					note: input.note,
				},
			});
			await refresh();
		},
		[refresh],
	);

	const addCategory = useCallback<StoreContextValue["addCategory"]>(
		async (input) => {
			await createCategoryFn({ data: input });
			await refresh();
		},
		[refresh],
	);

	const updateCategory = useCallback<StoreContextValue["updateCategory"]>(
		async (id, patch) => {
			await updateCategoryFn({
				data: { id, patch: { name: patch.name, active: patch.active } },
			});
			await refresh();
		},
		[refresh],
	);

	const toggleCategoryActive = useCallback<
		StoreContextValue["toggleCategoryActive"]
	>(
		async (id) => {
			await toggleCategoryActiveFn({ data: { id } });
			await refresh();
		},
		[refresh],
	);

	const addUser = useCallback<StoreContextValue["addUser"]>(
		async (input) => {
			await createUserFn({ data: input });
			await refresh();
		},
		[refresh],
	);

	const updateUser = useCallback<StoreContextValue["updateUser"]>(
		async (id, patch) => {
			await updateUserFn({
				data: {
					id,
					patch: {
						name: patch.name,
						role: patch.role,
						branchId: patch.branchId,
					},
				},
			});
			await refresh();
		},
		[refresh],
	);

	const addBranch = useCallback<StoreContextValue["addBranch"]>(
		async (input) => {
			await createBranchFn({ data: input });
			await refresh();
		},
		[refresh],
	);

	const resetUserPassword = useCallback<
		StoreContextValue["resetUserPassword"]
	>(async (userId) => {
		// Password lives in the auth tables, not AppData — nothing to refresh.
		await resetPasswordFn({ data: { userId } });
	}, []);

	const addToPlanTarget = useCallback<StoreContextValue["addToPlanTarget"]>(
		async (planId, amount) => {
			await addToPlanTargetFn({ data: { planId, amount } });
			await refresh();
		},
		[refresh],
	);

	const changePassword = useCallback<StoreContextValue["changePassword"]>(
		async (currentPassword, newPassword) =>
			changePasswordFn({ data: { currentPassword, newPassword } }),
		[],
	);

	const value = useMemo<StoreContextValue>(
		() => ({
			data,
			hydrated,
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
			hydrated,
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
