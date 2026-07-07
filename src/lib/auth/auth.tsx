// Auth context backed by Better Auth via server functions. The session lives
// in an HTTP-only cookie; this context mirrors it into React state.
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { getSessionFn, signInFn, signOutFn } from "#/lib/server/fns";
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

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [ready, setReady] = useState(false);

	const refresh = useCallback(async () => {
		const u = await getSessionFn();
		setUser(u);
	}, []);

	useEffect(() => {
		getSessionFn()
			.then((u) => setUser(u))
			.catch(() => setUser(null))
			.finally(() => setReady(true));
	}, []);

	const login = useCallback<AuthContextValue["login"]>(
		async (email, password) => {
			const res = await signInFn({ data: { email: email.trim(), password } });
			if (res.ok) {
				await refresh();
				return { ok: true };
			}
			return { ok: false, error: res.error };
		},
		[refresh],
	);

	const logout = useCallback<AuthContextValue["logout"]>(async () => {
		await signOutFn();
		setUser(null);
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
