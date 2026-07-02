import { createFileRoute } from "@tanstack/react-router";
import { Pencil, PlusCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Modal } from "#/components/ui/Overlay";
import {
	Badge,
	Button,
	Field,
	Input,
	SectionCard,
	Select,
} from "#/components/ui/primitives";
import { primaryCategories, subCategories } from "#/lib/calc";
import { useStore } from "#/lib/store/store";
import type { Category } from "#/lib/types";

export const Route = createFileRoute("/_app/categories")({
	component: CategoriesPage,
});

function CategoryRow({
	category,
	onEdit,
	onToggle,
}: {
	category: Category;
	onEdit: (c: Category) => void;
	onToggle: (id: string) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] py-3 last:border-0">
			<div className="flex items-center gap-2.5">
				<span className="font-medium text-[var(--color-ink)]">
					{category.name}
				</span>
				{category.active ? (
					<Badge tone="green">Active</Badge>
				) : (
					<Badge tone="neutral">Inactive</Badge>
				)}
			</div>
			<div className="flex items-center gap-1">
				<Button variant="ghost" onClick={() => onEdit(category)}>
					<Pencil size={14} /> Rename
				</Button>
				<Button variant="ghost" onClick={() => onToggle(category.id)}>
					{category.active ? "Deactivate" : "Activate"}
				</Button>
			</div>
		</div>
	);
}

function CategoriesPage() {
	const { data, addCategory, updateCategory, toggleCategoryActive } =
		useStore();

	const primaries = primaryCategories(data.categories);
	const otherCat =
		data.categories.find(
			(c) => c.parentId === null && c.name.toLowerCase() === "other",
		) ?? null;
	const subs = otherCat ? subCategories(data.categories, otherCat.id) : [];

	const [addOpen, setAddOpen] = useState(false);
	const [editing, setEditing] = useState<Category | null>(null);

	return (
		<div className="space-y-5">
			<SectionCard
				title="Primary categories"
				action={
					<Button onClick={() => setAddOpen(true)}>
						<PlusCircle size={15} /> Add category
					</Button>
				}
			>
				<p className="mb-2 text-sm text-[var(--color-muted)]">
					Shared across all branches. Branch users can only select{" "}
					<strong>active</strong> categories.
				</p>
				{primaries.map((c) => (
					<CategoryRow
						key={c.id}
						category={c}
						onEdit={setEditing}
						onToggle={toggleCategoryActive}
					/>
				))}
			</SectionCard>

			<SectionCard title={`"Other" sub-categories`}>
				<p className="mb-2 text-sm text-[var(--color-muted)]">
					Two-level structure only — sub-categories exist solely under{" "}
					<strong>Other</strong>, and are required when a submitter picks it.
				</p>
				{subs.length === 0 ? (
					<p className="py-3 text-sm text-[var(--color-muted)]">
						No sub-categories yet.
					</p>
				) : (
					subs.map((c) => (
						<CategoryRow
							key={c.id}
							category={c}
							onEdit={setEditing}
							onToggle={toggleCategoryActive}
						/>
					))
				)}
			</SectionCard>

			<AddCategoryModal
				open={addOpen}
				onClose={() => setAddOpen(false)}
				otherCatId={otherCat?.id ?? null}
				onAdd={(name, parentId) => addCategory({ name, parentId })}
			/>

			{editing && (
				<EditCategoryModal
					key={editing.id}
					category={editing}
					onClose={() => setEditing(null)}
					onSave={(id, name) => updateCategory(id, { name })}
				/>
			)}
		</div>
	);
}

function AddCategoryModal({
	open,
	onClose,
	otherCatId,
	onAdd,
}: {
	open: boolean;
	onClose: () => void;
	otherCatId: string | null;
	onAdd: (name: string, parentId: string | null) => void;
}) {
	const [name, setName] = useState("");
	const [kind, setKind] = useState<"primary" | "sub">("primary");
	const [error, setError] = useState<string | null>(null);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!name.trim()) return setError("Enter a category name.");
		if (kind === "sub" && !otherCatId)
			return setError(
				'No "Other" category exists to attach a sub-category to.',
			);
		onAdd(name.trim(), kind === "sub" ? otherCatId : null);
		setName("");
		setKind("primary");
		setError(null);
		onClose();
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Add category"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="add-category-form">
						Add
					</Button>
				</>
			}
		>
			<form
				id="add-category-form"
				onSubmit={handleSubmit}
				className="space-y-4"
			>
				<Field label="Type">
					<Select
						value={kind}
						onChange={(e) => setKind(e.target.value as "primary" | "sub")}
					>
						<option value="primary">Primary category</option>
						<option value="sub">Sub-category of "Other"</option>
					</Select>
				</Field>
				<Field label="Name" required>
					<Input
						placeholder="e.g. Travel & Accommodation"
						value={name}
						onChange={(e) => setName(e.target.value)}
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

// Rendered with key={category.id} so it mounts fresh per category — no
// in-render state syncing needed.
function EditCategoryModal({
	category,
	onClose,
	onSave,
}: {
	category: Category;
	onClose: () => void;
	onSave: (id: string, name: string) => void;
}) {
	const [name, setName] = useState(category.name);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (name.trim()) onSave(category.id, name.trim());
		onClose();
	}

	return (
		<Modal
			open
			onClose={onClose}
			title="Rename category"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="edit-category-form">
						Save
					</Button>
				</>
			}
		>
			<form id="edit-category-form" onSubmit={handleSubmit}>
				<Field label="Name" required>
					<Input value={name} onChange={(e) => setName(e.target.value)} />
				</Field>
			</form>
		</Modal>
	);
}
