import { createFileRoute } from "@tanstack/react-router";
import { Building2, KeyRound, Pencil, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { type Column, DataTable } from "#/components/ui/DataTable";
import { Modal } from "#/components/ui/Overlay";
import {
	Avatar,
	Badge,
	Button,
	Field,
	Input,
	SectionCard,
	Select,
} from "#/components/ui/primitives";
import { initials } from "#/lib/format";
import { useStore } from "#/lib/store/store";
import type { Role, User } from "#/lib/types";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

function UsersPage() {
	const { data, addUser, updateUser, resetUserPassword } = useStore();
	const [addOpen, setAddOpen] = useState(false);
	const [createBranchOpen, setCreateBranchOpen] = useState(false);
	const [editing, setEditing] = useState<User | null>(null);
	const [resetting, setResetting] = useState<User | null>(null);

	const branchName = (id: string | null) =>
		id ? (data.branches.find((b) => b.id === id)?.name ?? "—") : "— (HQ)";

	const columns: Column<User>[] = [
		{
			key: "name",
			header: "User",
			render: (u) => (
				<div className="flex items-center gap-2.5">
					<Avatar label={initials(u.name)} size={32} />
					<div>
						<p className="font-medium text-[var(--color-ink)]">{u.name}</p>
						<p className="text-xs text-[var(--color-muted)]">{u.email}</p>
					</div>
				</div>
			),
		},
		{
			key: "role",
			header: "Role",
			render: (u) =>
				u.role === "hq_admin" ? (
					<Badge tone="lime">HQ Admin</Badge>
				) : (
					<Badge tone="neutral">Branch User</Badge>
				),
		},
		{ key: "branch", header: "Branch", render: (u) => branchName(u.branchId) },
		{
			key: "action",
			header: "",
			align: "right",
			render: (u) => (
				<div className="flex items-center justify-end gap-1">
					<Button
						variant="ghost"
						onClick={() => setResetting(u)}
						title="Reset this account's password to demo123"
					>
						<KeyRound size={14} /> Reset password
					</Button>
					<Button variant="ghost" onClick={() => setEditing(u)}>
						<Pencil size={14} /> Edit
					</Button>
				</div>
			),
		},
	];

	return (
		<div className="space-y-5">
			<SectionCard
				title="Users & branch accounts"
				action={
					<div className="flex gap-2">
						<Button variant="ghost" onClick={() => setCreateBranchOpen(true)}>
							<Building2 size={15} /> Create branch
						</Button>
						<Button onClick={() => setAddOpen(true)}>
							<UserPlus size={15} /> Add user
						</Button>
					</div>
				}
			>
				<DataTable columns={columns} rows={data.users} getKey={(u) => u.id} />
				<p className="mt-3 text-xs text-[var(--color-muted)]">
					Each branch has one shared Branch User account. New accounts default
					to password <span className="font-mono">demo123</span>.
				</p>
			</SectionCard>

			<AddUserModal
				open={addOpen}
				onClose={() => setAddOpen(false)}
				onAdd={addUser}
			/>
			<CreateBranchModal
				open={createBranchOpen}
				onClose={() => setCreateBranchOpen(false)}
			/>
			{editing && (
				<EditUserModal
					key={editing.id}
					user={editing}
					onClose={() => setEditing(null)}
					onSave={(id, patch) => updateUser(id, patch)}
				/>
			)}
			{resetting && (
				<ResetPasswordModal
					key={resetting.id}
					user={resetting}
					onClose={() => setResetting(null)}
					onConfirm={() => resetUserPassword(resetting.id)}
				/>
			)}
		</div>
	);
}

function ResetPasswordModal({
	user,
	onClose,
	onConfirm,
}: {
	user: User;
	onClose: () => void;
	onConfirm: () => Promise<void>;
}) {
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleConfirm() {
		setBusy(true);
		setError(null);
		try {
			await onConfirm();
			setDone(true);
		} catch {
			setError("Could not reset the password. Please try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Modal
			open
			onClose={onClose}
			title="Reset password"
			footer={
				done ? (
					<Button onClick={onClose}>Done</Button>
				) : (
					<>
						<Button variant="ghost" onClick={onClose}>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleConfirm} disabled={busy}>
							{busy ? "Resetting…" : "Reset to demo123"}
						</Button>
					</>
				)
			}
		>
			{done ? (
				<div className="space-y-2">
					<p className="text-sm">
						<span className="font-semibold">{user.name}</span>'s password is now{" "}
						<span className="font-mono">demo123</span>.
					</p>
					<p className="text-sm text-[var(--color-muted)]">
						Share it with the branch. They sign in with{" "}
						<span className="font-mono">demo123</span>, then set a new one in
						Settings → Change password. All their data is unchanged.
					</p>
				</div>
			) : (
				<div className="space-y-2">
					<p className="text-sm">
						Reset the password for{" "}
						<span className="font-semibold">{user.name}</span> (
						<span className="font-mono">{user.email}</span>) back to the default{" "}
						<span className="font-mono">demo123</span>?
					</p>
					<p className="text-sm text-[var(--color-muted)]">
						Use this when a branch is locked out. Only the password changes —
						their transactions, role, and branch stay intact.
					</p>
					{error && (
						<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
							{error}
						</p>
					)}
				</div>
			)}
		</Modal>
	);
}

function CreateBranchModal({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const { data, addBranch } = useStore();
	const [name, setName] = useState("");
	const [country, setCountry] = useState("");
	const [currencyCode, setCurrencyCode] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const code = currencyCode.trim().toUpperCase();

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!name.trim()) return setError("Branch name is required.");
		if (!country.trim()) return setError("Country is required.");
		if (!/^[A-Z]{3}$/.test(code))
			return setError("Currency must be a 3-letter code (e.g. VND).");
		if (!email.trim() || !email.includes("@"))
			return setError("Enter a valid login email.");
		if (
			data.users.some(
				(u) => u.email.toLowerCase() === email.trim().toLowerCase(),
			)
		)
			return setError("A user with that email already exists.");
		if (password.length < 6)
			return setError("Password must be at least 6 characters.");
		setBusy(true);
		setError(null);
		try {
			await addBranch({
				name: name.trim(),
				country: country.trim(),
				currencyCode: code,
				loginEmail: email.trim(),
				defaultPassword: password,
			});
			onClose();
		} catch {
			setError("Could not create the branch. The email may already be in use.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Create branch"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="create-branch-form" disabled={busy}>
						{busy ? "Creating…" : "Create branch"}
					</Button>
				</>
			}
		>
			<form
				id="create-branch-form"
				onSubmit={handleSubmit}
				className="space-y-4"
			>
				<Field label="Branch name" required>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. Vietnam"
					/>
				</Field>
				<Field label="Country" required>
					<Input
						value={country}
						onChange={(e) => setCountry(e.target.value)}
						placeholder="e.g. Vietnam"
					/>
				</Field>
				<Field label="Currency code" required hint="3-letter ISO (VND, THB…)">
					<Input
						value={currencyCode}
						maxLength={3}
						onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
						placeholder="VND"
					/>
				</Field>
				<p className="rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
					Creates the branch plus a login account. The branch signs in with the
					email + password below and can change the password later in Settings.
				</p>
				<Field label="Login email" required>
					<Input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="vietnam@example.com"
					/>
				</Field>
				<Field label="Default password" required hint="At least 6 characters.">
					<Input
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Set a temporary password"
					/>
				</Field>
				{error && (
					<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
						{error}
					</p>
				)}
			</form>
		</Modal>
	);
}

function AddUserModal({
	open,
	onClose,
	onAdd,
}: {
	open: boolean;
	onClose: () => void;
	onAdd: (input: {
		name: string;
		email: string;
		role: Role;
		branchId: string | null;
	}) => void;
}) {
	const { data } = useStore();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<Role>("branch_user");
	const [branchId, setBranchId] = useState(data.branches[0]?.id ?? "");
	const [error, setError] = useState<string | null>(null);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!name.trim()) return setError("Name is required.");
		if (!email.trim() || !email.includes("@"))
			return setError("Enter a valid email.");
		if (data.users.some((u) => u.email.toLowerCase() === email.toLowerCase()))
			return setError("A user with that email already exists.");
		onAdd({
			name: name.trim(),
			email: email.trim(),
			role,
			branchId: role === "hq_admin" ? null : branchId,
		});
		setError(null);
		onClose();
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Add user"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="add-user-form">
						Add user
					</Button>
				</>
			}
		>
			<form id="add-user-form" onSubmit={handleSubmit} className="space-y-4">
				<Field label="Name" required>
					<Input value={name} onChange={(e) => setName(e.target.value)} />
				</Field>
				<Field label="Email" required>
					<Input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
				</Field>
				<Field label="Role" required>
					<Select
						value={role}
						onChange={(e) => setRole(e.target.value as Role)}
					>
						<option value="branch_user">Branch User</option>
						<option value="hq_admin">HQ Admin</option>
					</Select>
				</Field>
				{role === "branch_user" && (
					<Field label="Branch" required>
						<Select
							value={branchId}
							onChange={(e) => setBranchId(e.target.value)}
						>
							{data.branches.map((b) => (
								<option key={b.id} value={b.id}>
									{b.name}
								</option>
							))}
						</Select>
					</Field>
				)}
				{error && (
					<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
						{error}
					</p>
				)}
			</form>
		</Modal>
	);
}

function EditUserModal({
	user,
	onClose,
	onSave,
}: {
	user: User;
	onClose: () => void;
	onSave: (id: string, patch: Partial<User>) => void;
}) {
	const { data } = useStore();
	const [name, setName] = useState(user.name);
	const [role, setRole] = useState<Role>(user.role);
	const [branchId, setBranchId] = useState(
		user.branchId ?? data.branches[0]?.id ?? "",
	);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		onSave(user.id, {
			name: name.trim() || user.name,
			role,
			branchId: role === "hq_admin" ? null : branchId,
		});
		onClose();
	}

	return (
		<Modal
			open
			onClose={onClose}
			title="Edit user"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="edit-user-form">
						Save
					</Button>
				</>
			}
		>
			<form id="edit-user-form" onSubmit={handleSubmit} className="space-y-4">
				<Field label="Name" required>
					<Input value={name} onChange={(e) => setName(e.target.value)} />
				</Field>
				<Field label="Email">
					<Input value={user.email} disabled />
				</Field>
				<Field label="Role" required>
					<Select
						value={role}
						onChange={(e) => setRole(e.target.value as Role)}
					>
						<option value="branch_user">Branch User</option>
						<option value="hq_admin">HQ Admin</option>
					</Select>
				</Field>
				{role === "branch_user" && (
					<Field label="Branch" required>
						<Select
							value={branchId}
							onChange={(e) => setBranchId(e.target.value)}
						>
							{data.branches.map((b) => (
								<option key={b.id} value={b.id}>
									{b.name}
								</option>
							))}
						</Select>
					</Field>
				)}
			</form>
		</Modal>
	);
}
