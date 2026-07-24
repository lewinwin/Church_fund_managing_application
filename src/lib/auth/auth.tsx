// UI-only mock auth. No server, no Better Auth — logins are matched against the
// demo users in the mock dataset and remembered in localStorage. Same
// useAuth() shape as the real provider, so components are unchanged.
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { buildMockData } from "#/lib/mock/mockData";
import type { Role } from "#/lib/types";

export interface AuthUser {
	id: string;
	name: string;
	email: string;
	role: Role;
	branchId: string | null;
}

interface AuthContextValue {
	user: AuthUser | null;
	ready: boolean;
	login: (
		email: string,
		password: string,
	) => Promise<{ ok: boolean; error?: string }>;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "mock-auth-user";

const DEMO_USERS: AuthUser[] = buildMockData().users.map((u) => ({
	id: u.id,
	name: u.name,
	email: u.email,
	role: u.role,
	branchId: u.branchId,
}));

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [ready, setReady] = useState(false);

	// Restore a remembered session on the client (server render starts signed out,
	// then this effect hydrates — mirrors the real async-session flow).
	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const email = JSON.parse(raw) as string;
				setUser(DEMO_USERS.find((u) => u.email === email) ?? null);
			}
		} catch {
			// ignore
		}
		setReady(true);
	}, []);

	const login = useCallback<AuthContextValue["login"]>(async (email) => {
		const found = DEMO_USERS.find(
			(u) => u.email.toLowerCase() === email.trim().toLowerCase(),
		);
		if (!found) return { ok: false, error: "Unknown demo account." };
		setUser(found);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(found.email));
		} catch {
			// ignore
		}
		return { ok: true };
	}, []);

	const logout = useCallback<AuthContextValue["logout"]>(async () => {
		setUser(null);
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignore
		}
	}, []);

	const value = useMemo<AuthContextValue>(
		() => ({ user, ready, login, logout }),
		[user, ready, login, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
