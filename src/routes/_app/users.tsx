import { createFileRoute } from "@tanstack/react-router";
import { Pencil, UserPlus } from "lucide-react";
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
	const { data, addUser, updateUser } = useStore();
	const [addOpen, setAddOpen] = useState(false);
	const [editing, setEditing] = useState<User | null>(null);

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
				<Button variant="ghost" onClick={() => setEditing(u)}>
					<Pencil size={14} /> Edit
				</Button>
			),
		},
	];

	return (
		<div className="space-y-5">
			<SectionCard
				title="Users & branch accounts"
				action={
					<Button onClick={() => setAddOpen(true)}>
						<UserPlus size={15} /> Add user
					</Button>
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
			{editing && (
				<EditUserModal
					key={editing.id}
					user={editing}
					onClose={() => setEditing(null)}
					onSave={(id, patch) => updateUser(id, patch)}
				/>
			)}
		</div>
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
