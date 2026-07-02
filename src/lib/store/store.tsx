// AppData React context — the in-memory mirror of localStorage that the whole
// UI reads and mutates. Every write persists to localStorage and updates state
// so all views re-render consistently.
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { buildSeedData } from "#/data/seed";
import { newId } from "#/lib/id";
import type {
	AppData,
	Category,
	Expense,
	FundingPlan,
	FundRelease,
	Role,
	User,
} from "#/lib/types";
import { loadData, resetData, saveData } from "./persistence";

export type NewExpense = Omit<Expense, "id" | "createdAt">;
export type NewFundingPlan = Omit<FundingPlan, "id" | "createdAt">;
export type NewFundRelease = Omit<FundRelease, "id" | "createdAt">;

interface StoreContextValue {
	data: AppData;
	hydrated: boolean;
	addExpense: (input: NewExpense) => Expense;
	addFundingPlan: (input: NewFundingPlan) => FundingPlan;
	addFundRelease: (input: NewFundRelease) => FundRelease;
	addCategory: (input: { name: string; parentId: string | null }) => Category;
	updateCategory: (id: string, patch: Partial<Category>) => void;
	toggleCategoryActive: (id: string) => void;
	addUser: (input: {
		name: string;
		email: string;
		role: Role;
		branchId: string | null;
	}) => User;
	updateUser: (id: string, patch: Partial<User>) => void;
	resetDemo: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
	// Initialise with seed so SSR + first client render match; hydrate on mount.
	const [data, setData] = useState<AppData>(() => buildSeedData());
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		setData(loadData());
		setHydrated(true);
	}, []);

	const commit = useCallback((next: AppData) => {
		setData(next);
		saveData(next);
	}, []);

	const addExpense = useCallback<StoreContextValue["addExpense"]>((input) => {
		const expense: Expense = {
			...input,
			id: newId("exp"),
			createdAt: new Date().toISOString(),
		};
		setData((prev) => {
			const next = { ...prev, expenses: [expense, ...prev.expenses] };
			saveData(next);
			return next;
		});
		return expense;
	}, []);

	const addFundingPlan = useCallback<StoreContextValue["addFundingPlan"]>(
		(input) => {
			const plan: FundingPlan = {
				...input,
				id: newId("fp"),
				createdAt: new Date().toISOString(),
			};
			setData((prev) => {
				const next = {
					...prev,
					fundingPlans: [plan, ...prev.fundingPlans],
				};
				saveData(next);
				return next;
			});
			return plan;
		},
		[],
	);

	const addFundRelease = useCallback<StoreContextValue["addFundRelease"]>(
		(input) => {
			const release: FundRelease = {
				...input,
				id: newId("fr"),
				createdAt: new Date().toISOString(),
			};
			setData((prev) => {
				const next = {
					...prev,
					fundReleases: [release, ...prev.fundReleases],
				};
				saveData(next);
				return next;
			});
			return release;
		},
		[],
	);

	const addCategory = useCallback<StoreContextValue["addCategory"]>((input) => {
		const category: Category = {
			id: newId(input.parentId ? "sub" : "cat"),
			name: input.name,
			parentId: input.parentId,
			active: true,
			createdAt: new Date().toISOString(),
		};
		setData((prev) => {
			const next = {
				...prev,
				categories: [...prev.categories, category],
			};
			saveData(next);
			return next;
		});
		return category;
	}, []);

	const updateCategory = useCallback<StoreContextValue["updateCategory"]>(
		(id, patch) => {
			setData((prev) => {
				const next = {
					...prev,
					categories: prev.categories.map((c) =>
						c.id === id ? { ...c, ...patch } : c,
					),
				};
				saveData(next);
				return next;
			});
		},
		[],
	);

	const toggleCategoryActive = useCallback<
		StoreContextValue["toggleCategoryActive"]
	>((id) => {
		setData((prev) => {
			const next = {
				...prev,
				categories: prev.categories.map((c) =>
					c.id === id ? { ...c, active: !c.active } : c,
				),
			};
			saveData(next);
			return next;
		});
	}, []);

	const addUser = useCallback<StoreContextValue["addUser"]>((input) => {
		const user: User = {
			id: newId("u"),
			name: input.name,
			email: input.email,
			password: "demo123",
			role: input.role,
			branchId: input.role === "hq_admin" ? null : input.branchId,
			createdAt: new Date().toISOString(),
		};
		setData((prev) => {
			const next = { ...prev, users: [...prev.users, user] };
			saveData(next);
			return next;
		});
		return user;
	}, []);

	const updateUser = useCallback<StoreContextValue["updateUser"]>(
		(id, patch) => {
			setData((prev) => {
				const next = {
					...prev,
					users: prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
				};
				saveData(next);
				return next;
			});
		},
		[],
	);

	const resetDemo = useCallback(() => {
		commit(resetData());
	}, [commit]);

	const value = useMemo<StoreContextValue>(
		() => ({
			data,
			hydrated,
			addExpense,
			addFundingPlan,
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
