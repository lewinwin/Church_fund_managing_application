import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
	Avatar,
	Button,
	Field,
	Input,
	SectionCard,
} from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { branchById } from "#/lib/calc";
import { initials } from "#/lib/format";
import { useStore } from "#/lib/store/store";

export const Route = createFileRoute("/_app/settings")({
	component: SettingsPage,
});

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between border-b border-[var(--color-line)] py-3 last:border-0">
			<span className="text-sm text-[var(--color-muted)]">{label}</span>
			<span className="text-sm font-medium text-[var(--color-ink)]">
				{value}
			</span>
		</div>
	);
}

function ChangePasswordCard() {
	const { changePassword } = useStore();
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setMsg(null);
		if (next.length < 6)
			return setMsg({
				ok: false,
				text: "New password must be at least 6 characters.",
			});
		if (next !== confirm)
			return setMsg({ ok: false, text: "New passwords don't match." });
		setBusy(true);
		const res = await changePassword(current, next);
		setBusy(false);
		if (res.ok) {
			setMsg({ ok: true, text: "Password changed." });
			setCurrent("");
			setNext("");
			setConfirm("");
		} else {
			setMsg({ ok: false, text: res.error ?? "Could not change password." });
		}
	}

	return (
		<SectionCard title="Change password">
			<form onSubmit={handleSubmit} className="space-y-3">
				<Field label="Current password" required>
					<Input
						type="password"
						autoComplete="current-password"
						value={current}
						onChange={(e) => setCurrent(e.target.value)}
					/>
				</Field>
				<Field label="New password" required>
					<Input
						type="password"
						autoComplete="new-password"
						value={next}
						onChange={(e) => setNext(e.target.value)}
					/>
				</Field>
				<Field label="Confirm new password" required>
					<Input
						type="password"
						autoComplete="new-password"
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
					/>
				</Field>
				{msg && (
					<p
						className={`rounded-lg px-3 py-2 text-sm ${
							msg.ok
								? "bg-[#e4f4ea] text-[var(--color-positive)]"
								: "bg-[#fdecea] text-[var(--color-negative)]"
						}`}
					>
						{msg.text}
					</p>
				)}
				<Button type="submit" disabled={busy}>
					{busy ? "Saving…" : "Update password"}
				</Button>
			</form>
		</SectionCard>
	);
}

function SettingsPage() {
	const { user, logout } = useAuth();
	const { data } = useStore();
	const navigate = useNavigate();

	if (!user) return null;
	const branch = branchById(data.branches, user.branchId);

	function handleLogout() {
		logout();
		navigate({ to: "/login" });
	}

	return (
		<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
			<SectionCard title="Account">
				<div className="mb-4 flex items-center gap-3">
					<Avatar label={initials(user.name)} size={48} />
					<div>
						<p className="font-semibold">{user.name}</p>
						<p className="text-sm text-[var(--color-muted)]">{user.email}</p>
					</div>
				</div>
				<InfoRow label="Email" value={user.email} />
				<InfoRow
					label="Role"
					value={user.role === "hq_admin" ? "HQ Admin" : "Branch User"}
				/>
				<div className="mt-4">
					<Button variant="danger" onClick={handleLogout}>
						<LogOut size={16} /> Log out
					</Button>
				</div>
			</SectionCard>

			{branch ? (
				<SectionCard title="Branch information">
					<InfoRow label="Branch" value={branch.name} />
					<InfoRow label="Country" value={branch.country} />
					<InfoRow label="Local currency" value={branch.localCurrency} />
					<InfoRow
						label="Rate to USD"
						value={`1 ${branch.localCurrency} = ${branch.exchangeRateToUsd} USD`}
					/>
					<p className="mt-3 rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
						This is the fixed exchange rate HQ set for your branch. Contact HQ
						if it needs updating.
					</p>
				</SectionCard>
			) : (
				<SectionCard title="Headquarters">
					<InfoRow label="Scope" value="All branches" />
					<InfoRow label="Reporting currency" value="USD" />
					<InfoRow
						label="Branches managed"
						value={String(data.branches.length)}
					/>
				</SectionCard>
			)}

			<ChangePasswordCard />
		</div>
	);
}
