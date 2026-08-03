import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { type Column, DataTable } from "#/components/ui/DataTable";
import { EmptyState, Input, Select } from "#/components/ui/primitives";
import { categoryLabel, primaryCategories } from "#/lib/calc";
import { formatDate, formatMoney } from "#/lib/format";
import type { Category, Expense } from "#/lib/types";

// Reused by Branch "My Receipts" and HQ Branch Detail. Includes the search +
// category filter toolbar and the table body.
export function ExpenseTable({
	expenses,
	categories,
	onSelect,
	showBranchColumn,
	branchName,
}: {
	expenses: Expense[];
	categories: Category[];
	onSelect: (expense: Expense) => void;
	showBranchColumn?: (expense: Expense) => string;
	branchName?: string;
}) {
	const [query, setQuery] = useState("");
	const [categoryId, setCategoryId] = useState("all");

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return expenses
			.filter((e) =>
				categoryId === "all" ? true : e.categoryId === categoryId,
			)
			.filter((e) => (q ? e.description.toLowerCase().includes(q) : true))
			.sort(
				(a, b) =>
					new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime(),
			);
	}, [expenses, query, categoryId]);

	const columns: Column<Expense>[] = [
		{
			key: "date",
			header: "Date",
			render: (e) => formatDate(e.expenseDate),
		},
		{
			key: "description",
			header: "Description",
			render: (e) => (
				<span className="font-medium text-[var(--color-ink)]">
					{e.description}
				</span>
			),
		},
		...(showBranchColumn
			? [
					{
						key: "branch",
						header: "Branch",
						render: (e: Expense) => showBranchColumn(e),
					} satisfies Column<Expense>,
				]
			: []),
		{
			key: "category",
			header: "Category",
			render: (e) => (
				<span className="text-[var(--color-muted)]">
					{categoryLabel(categories, e.categoryId, e.otherSubcategoryId)}
				</span>
			),
		},
		{
			key: "local",
			header: "Amount",
			align: "right",
			render: (e) => (
				<span className="font-semibold">
					{formatMoney(e.localAmount, e.localCurrency)}
				</span>
			),
		},
	];

	return (
		<div>
			<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
				<div className="relative flex-1">
					<Search
						size={16}
						className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
					/>
					<Input
						className="pl-9"
						placeholder="Search description…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				</div>
				<Select
					className="sm:w-56"
					value={categoryId}
					onChange={(e) => setCategoryId(e.target.value)}
				>
					<option value="all">All categories</option>
					{primaryCategories(categories).map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</Select>
			</div>

			<DataTable
				columns={columns}
				rows={filtered}
				getKey={(e) => e.id}
				onRowClick={onSelect}
				empty={
					<EmptyState
						title="No matching receipts"
						description={
							branchName
								? `No expenses found for ${branchName} with these filters.`
								: "Try adjusting your search or filters."
						}
					/>
				}
			/>
		</div>
	);
}
