import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { type Column, DataTable } from "#/components/ui/DataTable";
import {
	Button,
	EmptyState,
	Field,
	Input,
	SectionCard,
	Select,
} from "#/components/ui/primitives";
import { StatCard } from "#/components/ui/StatCard";
import { useAuth } from "#/lib/auth/auth";
import { categoryLabel, primaryCategories } from "#/lib/calc";
import { type CsvRow, downloadCsv, printReport } from "#/lib/export";
import {
	formatDate,
	formatDateTime,
	formatMoney,
	formatWithCode,
} from "#/lib/format";
import { ledgerFor, spentOf } from "#/lib/ledger";
import { useStore } from "#/lib/store/store";
import type { Expense } from "#/lib/types";

export const Route = createFileRoute("/_app/reports")({
	component: ReportsPage,
});

function ReportsPage() {
	const { user } = useAuth();
	const { data } = useStore();
	const isHq = user?.role === "hq_admin";

	// Data is already RLS-scoped server-side (branch user = own branch only).
	const base = data.expenses;

	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	// A report is always scoped to one branch — there is no common currency to
	// total across branches. HQ picks a branch; a branch user sees their own.
	const [branchId, setBranchId] = useState(
		user?.branchId ?? data.branches[0]?.id ?? "",
	);
	const [categoryId, setCategoryId] = useState("all");

	const filtered = useMemo(() => {
		return base
			.filter((e) => e.branchId === branchId)
			.filter((e) => (categoryId === "all" ? true : e.categoryId === categoryId))
			.filter((e) => (from ? e.expenseDate >= from : true))
			.filter((e) => (to ? e.expenseDate <= to : true))
			.sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1));
	}, [base, branchId, categoryId, from, to]);

	// Spend over the filtered set, excluding cancelled — same rule as the branch
	// balance, so this tile can't disagree with Remaining.
	const spentFiltered = spentOf(filtered);

	// Released / remaining for the selected branch, in its local currency.
	const led = useMemo(() => ledgerFor(data, branchId), [data, branchId]);

	const branchName = (id: string) =>
		data.branches.find((b) => b.id === id)?.name ?? id;

	const currency = led.currency;
	// Summary tiles show the amount with the currency CODE (e.g. "6,100.00 SGD").
	const statMoney = (n: number) => formatWithCode(n, currency);

	const columns: Column<Expense>[] = [
		{ key: "date", header: "Date", render: (e) => formatDate(e.expenseDate) },
		{
			key: "description",
			header: "Description",
			render: (e) => <span className="font-medium">{e.description}</span>,
		},
		{
			key: "category",
			header: "Category",
			render: (e) =>
				categoryLabel(data.categories, e.categoryId, e.otherSubcategoryId),
		},
		{
			key: "amount",
			header: "Amount",
			align: "right",
			render: (e) => (
				<span className="font-semibold">
					{formatMoney(e.localAmount, e.localCurrency)}
				</span>
			),
		},
	];

	function buildCsvRows(): CsvRow[] {
		return filtered.map((e) => ({
			Date: e.expenseDate,
			Description: e.description,
			Branch: branchName(e.branchId),
			Category: categoryLabel(
				data.categories,
				e.categoryId,
				e.otherSubcategoryId,
			),
			Amount: e.localAmount,
			Currency: e.localCurrency,
			"Submitted at": formatDateTime(e.createdAt),
		}));
	}

	function handleCsv() {
		downloadCsv(
			`ministry-funding-report-${branchName(branchId)}`,
			buildCsvRows(),
		);
	}

	function handlePdf() {
		printReport(
			"611 Ministry Funding — Expense Report",
			`${branchName(branchId)} · ${from || "start"} → ${to || "today"}`,
			[
				{ label: "Total released", value: statMoney(led.released) },
				{ label: "Spent (filtered)", value: statMoney(spentFiltered) },
				{ label: "Remaining", value: statMoney(led.remaining) },
				{ label: "Receipts", value: String(filtered.length) },
			],
			{
				columns: ["Date", "Description", "Category", "Amount"],
				rows: filtered.map((e) => [
					e.expenseDate,
					e.description,
					categoryLabel(data.categories, e.categoryId, e.otherSubcategoryId),
					formatMoney(e.localAmount, e.localCurrency),
				]),
			},
		);
	}

	return (
		<div className="space-y-5">
			<SectionCard title="Filters">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Field label="From date">
						<Input
							type="date"
							value={from}
							onChange={(e) => setFrom(e.target.value)}
						/>
					</Field>
					<Field label="To date">
						<Input
							type="date"
							value={to}
							onChange={(e) => setTo(e.target.value)}
						/>
					</Field>
					{isHq && (
						<Field label="Branch">
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
					<Field label="Category">
						<Select
							value={categoryId}
							onChange={(e) => setCategoryId(e.target.value)}
						>
							<option value="all">All categories</option>
							{primaryCategories(data.categories).map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</Select>
					</Field>
				</div>
			</SectionCard>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard label="Total released" value={statMoney(led.released)} />
				<StatCard
					label="Spent (filtered)"
					value={statMoney(spentFiltered)}
					accent="red"
				/>
				<StatCard
					label="Remaining"
					value={statMoney(led.remaining)}
					accent="lime"
				/>
				<StatCard label="Receipts" value={String(filtered.length)} />
			</div>

			<SectionCard
				title="Expense report"
				action={
					<div className="flex gap-2">
						<Button
							variant="ghost"
							onClick={handleCsv}
							disabled={!filtered.length}
						>
							<Download size={15} /> CSV
						</Button>
						<Button
							variant="ghost"
							onClick={handlePdf}
							disabled={!filtered.length}
						>
							<FileText size={15} /> PDF
						</Button>
					</div>
				}
			>
				<DataTable
					columns={columns}
					rows={filtered}
					getKey={(e) => e.id}
					empty={
						<EmptyState
							title="No expenses in range"
							description="Adjust the filters to see results."
						/>
					}
				/>
			</SectionCard>
		</div>
	);
}
