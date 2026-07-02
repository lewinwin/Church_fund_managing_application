import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Modal } from "#/components/ui/Overlay";
import { Avatar, Badge, Button, SectionCard } from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";
import { branchById } from "#/lib/calc";
import { rateToUsd } from "#/lib/currency/exchangeRate";
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

function SettingsPage() {
	const { user, logout } = useAuth();
	const { data, resetDemo } = useStore();
	const navigate = useNavigate();
	const [confirmReset, setConfirmReset] = useState(false);

	if (!user) return null;
	const branch = branchById(data.branches, user.branchId);

	function handleLogout() {
		logout();
		navigate({ to: "/login" });
	}

	function handleReset() {
		resetDemo();
		setConfirmReset(false);
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
						value={`1 ${branch.localCurrency} = ${rateToUsd(
							branch.localCurrency,
						)} USD`}
					/>
					<p className="mt-3 rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
						Fixed mock rate for Week 1. A live exchange-rate provider lands in
						W3.
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

			<SectionCard title="Demo data" className="lg:col-span-2">
				<div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
					<div>
						<p className="text-sm font-medium">Reset to seed data</p>
						<p className="text-sm text-[var(--color-muted)]">
							Restores the original demo branches, expenses and funding plans.
							Anything you added in this browser will be cleared.
						</p>
					</div>
					<Button variant="ghost" onClick={() => setConfirmReset(true)}>
						<RotateCcw size={15} /> Reset demo data
					</Button>
				</div>
				<div className="mt-3">
					<Badge tone="amber">
						Prototype · all data lives in your browser (localStorage)
					</Badge>
				</div>
			</SectionCard>

			<Modal
				open={confirmReset}
				onClose={() => setConfirmReset(false)}
				title="Reset demo data?"
				footer={
					<>
						<Button variant="ghost" onClick={() => setConfirmReset(false)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleReset}>
							Reset everything
						</Button>
					</>
				}
			>
				<p className="text-sm text-[var(--color-muted)]">
					This restores the seed dataset and removes any expenses, fund
					releases, categories or users you created in this browser. This can't
					be undone.
				</p>
			</Modal>
		</div>
	);
}
