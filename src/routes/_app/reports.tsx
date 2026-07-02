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
import {
	branchFinancials,
	categoryLabel,
	globalTotals,
	primaryCategories,
	visibleExpenses,
} from "#/lib/calc";
import { type CsvRow, downloadCsv, printReport } from "#/lib/export";
import {
	formatDate,
	formatDateTime,
	formatMoney,
	formatUsd,
} from "#/lib/format";
import { useStore } from "#/lib/store/store";
import type { Expense } from "#/lib/types";

export const Route = createFileRoute("/_app/reports")({
	component: ReportsPage,
});

type CurrencyView = "both" | "usd" | "local";

function ReportsPage() {
	const { user } = useAuth();
	const { data } = useStore();
	const isHq = user?.role === "hq_admin";

	const base = user ? visibleExpenses(data, user) : [];

	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [branchId, setBranchId] = useState(user?.branchId ?? "all");
	const [categoryId, setCategoryId] = useState("all");
	const [currencyView, setCurrencyView] = useState<CurrencyView>("both");

	const filtered = useMemo(() => {
		return base
			.filter((e) => (branchId === "all" ? true : e.branchId === branchId))
			.filter((e) =>
				categoryId === "all" ? true : e.categoryId === categoryId,
			)
			.filter((e) => (from ? e.expenseDate >= from : true))
			.filter((e) => (to ? e.expenseDate <= to : true))
			.sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1));
	}, [base, branchId, categoryId, from, to]);

	const spentFiltered = filtered.reduce((s, e) => s + e.usdAmount, 0);

	// Released / remaining reflect the selected scope (a branch, or all).
	const scope = useMemo(() => {
		if (branchId === "all") {
			const t = globalTotals(data);
			return { released: t.releasedUsd, remaining: t.remainingUsd };
		}
		const f = branchFinancials(data, branchId);
		return { released: f.releasedUsd, remaining: f.remainingUsd };
	}, [data, branchId]);

	const branchName = (id: string) =>
		data.branches.find((b) => b.id === id)?.name ?? id;

	const showLocal = currencyView !== "usd";
	const showUsd = currencyView !== "local";

	const columns: Column<Expense>[] = [
		{ key: "date", header: "Date", render: (e) => formatDate(e.expenseDate) },
		{
			key: "merchant",
			header: "Merchant",
			render: (e) => <span className="font-medium">{e.merchantName}</span>,
		},
		...(isHq
			? [
					{
						key: "branch",
						header: "Branch",
						render: (e: Expense) => branchName(e.branchId),
					} satisfies Column<Expense>,
				]
			: []),
		{
			key: "category",
			header: "Category",
			render: (e) =>
				categoryLabel(data.categories, e.categoryId, e.otherSubcategoryId),
		},
		...(showLocal
			? [
					{
						key: "local",
						header: "Local",
						align: "right",
						render: (e: Expense) => formatMoney(e.localAmount, e.localCurrency),
					} satisfies Column<Expense>,
				]
			: []),
		...(showUsd
			? [
					{
						key: "usd",
						header: "USD",
						align: "right",
						render: (e: Expense) => (
							<span className="font-semibold">{formatUsd(e.usdAmount)}</span>
						),
					} satisfies Column<Expense>,
				]
			: []),
	];

	function buildCsvRows(): CsvRow[] {
		return filtered.map((e) => ({
			Date: e.expenseDate,
			Merchant: e.merchantName,
			Branch: branchName(e.branchId),
			Category: categoryLabel(
				data.categories,
				e.categoryId,
				e.otherSubcategoryId,
			),
			"Local amount": e.localAmount,
			Currency: e.localCurrency,
			"Exchange rate": e.exchangeRateToUsd,
			USD: e.usdAmount,
			"Submitted at": formatDateTime(e.createdAt),
		}));
	}

	function handleCsv() {
		const scopeLabel =
			branchId === "all" ? "all-branches" : branchName(branchId);
		downloadCsv(`petty-cash-report-${scopeLabel}`, buildCsvRows());
	}

	function handlePdf() {
		const scopeLabel =
			branchId === "all" ? "All branches" : branchName(branchId);
		printReport(
			"Petty Cash Expense Report",
			`${scopeLabel} · ${from || "start"} → ${to || "today"}`,
			[
				{ label: "Total released", value: formatUsd(scope.released) },
				{ label: "Spent (filtered)", value: formatUsd(spentFiltered) },
				{ label: "Remaining", value: formatUsd(scope.remaining) },
				{ label: "Receipts", value: String(filtered.length) },
			],
			{
				columns: ["Date", "Merchant", "Branch", "Category", "Local", "USD"],
				rows: filtered.map((e) => [
					e.expenseDate,
					e.merchantName,
					branchName(e.branchId),
					categoryLabel(data.categories, e.categoryId, e.otherSubcategoryId),
					formatMoney(e.localAmount, e.localCurrency),
					formatUsd(e.usdAmount),
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
								<option value="all">All branches</option>
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
					{isHq && (
						<Field label="Currency view">
							<Select
								value={currencyView}
								onChange={(e) =>
									setCurrencyView(e.target.value as CurrencyView)
								}
							>
								<option value="both">USD + local</option>
								<option value="usd">USD only</option>
								<option value="local">Local only</option>
							</Select>
						</Field>
					)}
				</div>
			</SectionCard>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard label="Total released" value={formatUsd(scope.released)} />
				<StatCard
					label="Spent (filtered)"
					value={formatUsd(spentFiltered)}
					accent="red"
				/>
				<StatCard
					label="Remaining"
					value={formatUsd(scope.remaining)}
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
