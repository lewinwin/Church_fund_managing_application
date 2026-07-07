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
	bootstrapFn,
	createCategoryFn,
	createFundingPlanFn,
	createUserFn,
	recordFundReleaseFn,
	submitExpenseFn,
	toggleCategoryActiveFn,
	updateCategoryFn,
	updateFundingPlanFn,
	updateUserFn,
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

export type NewExpense = Omit<Expense, "id" | "createdAt">;
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

interface StoreContextValue {
	data: AppData;
	hydrated: boolean;
	addExpense: (input: NewExpense) => Promise<void>;
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
	resetDemo: () => Promise<void>;
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
			await submitExpenseFn({
				data: {
					description: input.description,
					expenseDate: input.expenseDate,
					localAmount: input.localAmount,
					localCurrency: input.localCurrency,
					exchangeRateToUsd: input.exchangeRateToUsd,
					usdAmount: input.usdAmount,
					categoryId: input.categoryId,
					otherSubcategoryId: input.otherSubcategoryId,
					receiptFileName: input.receiptFileName,
					receiptDataUrl: input.receiptDataUrl,
					ocrConfidence: input.ocrConfidence,
				},
			});
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
						totalTargetUsd: patch.totalTargetUsd,
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
					amountUsd: input.amountUsd,
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

	const resetDemo = useCallback<StoreContextValue["resetDemo"]>(async () => {
		await refresh();
	}, [refresh]);

	const value = useMemo<StoreContextValue>(
		() => ({
			data,
			hydrated,
			addExpense,
			addFundingPlan,
			updateFundingPlan,
			addFundRelease,
			addCategory,
			updateCategory,
			toggleCategoryActive,
			addUser,
			updateUser,
			resetDemo,
		}),
		[
			data,
			hydrated,
			addExpense,
			addFundingPlan,
			updateFundingPlan,
			addFundRelease,
			addCategory,
			updateCategory,
			toggleCategoryActive,
			addUser,
			updateUser,
			resetDemo,
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
