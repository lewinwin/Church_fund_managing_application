// localStorage persistence layer. The ONLY module that touches localStorage
// directly — everything else goes through the AppData context (store.tsx).
// W2 swaps these internals for Drizzle/DB queries with zero UI changes.
import { buildSeedData } from "#/data/seed";
import type { AppData, Session } from "#/lib/types";

const DATA_KEY = "pettycash.data";
const SESSION_KEY = "pettycash.session";

function hasStorage(): boolean {
	return typeof window !== "undefined" && !!window.localStorage;
}

export function loadData(): AppData {
	if (!hasStorage()) return buildSeedData();
	try {
		const raw = window.localStorage.getItem(DATA_KEY);
		if (!raw) {
			const seed = buildSeedData();
			window.localStorage.setItem(DATA_KEY, JSON.stringify(seed));
			return seed;
		}
		return JSON.parse(raw) as AppData;
	} catch {
		return buildSeedData();
	}
}

export function saveData(data: AppData): void {
	if (!hasStorage()) return;
	try {
		window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
	} catch {
		// Quota exceeded (large base64 receipts). Non-fatal for the prototype.
	}
}

export function resetData(): AppData {
	const seed = buildSeedData();
	saveData(seed);
	return seed;
}

export function loadSession(): Session | null {
	if (!hasStorage()) return null;
	try {
		const raw = window.localStorage.getItem(SESSION_KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}

export function saveSession(session: Session | null): void {
	if (!hasStorage()) return;
	if (session) {
		window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
	} else {
		window.localStorage.removeItem(SESSION_KEY);
	}
}
