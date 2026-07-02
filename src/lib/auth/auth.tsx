// Fake auth context — dev only. Validates email/password against mock users
// and stores the session in localStorage. Real Better Auth lands W2.
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { loadSession, saveSession } from "#/lib/store/persistence";
import { useStore } from "#/lib/store/store";
import type { Session, User } from "#/lib/types";

interface AuthContextValue {
	user: User | null;
	ready: boolean;
	login: (email: string, password: string) => { ok: boolean; error?: string };
	logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const { data } = useStore();
	const [session, setSession] = useState<Session | null>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		setSession(loadSession());
		setReady(true);
	}, []);

	const user = useMemo<User | null>(() => {
		if (!session) return null;
		return data.users.find((u) => u.id === session.userId) ?? null;
	}, [session, data.users]);

	const login = useCallback<AuthContextValue["login"]>(
		(email, password) => {
			const match = data.users.find(
				(u) => u.email.toLowerCase() === email.trim().toLowerCase(),
			);
			if (!match || match.password !== password) {
				return { ok: false, error: "Invalid email or password." };
			}
			const next = { userId: match.id };
			setSession(next);
			saveSession(next);
			return { ok: true };
		},
		[data.users],
	);

	const logout = useCallback(() => {
		setSession(null);
		saveSession(null);
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
