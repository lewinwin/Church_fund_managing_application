// The list of fund releases (top-ups from HQ) for one branch, in the branch's
// local currency. Shown on the HQ branch-detail page and on the branch's own
// My Receipts page, so a branch can see the money it has been given.
import { type Column, DataTable } from "#/components/ui/DataTable";
import { EmptyState, SectionCard } from "#/components/ui/primitives";
import { userById } from "#/lib/calc";
import { usdToLocal } from "#/lib/currency/exchangeRate";
import { formatDate, formatMoney } from "#/lib/format";
import type { CurrencyCode, FundRelease, User } from "#/lib/types";

export function FundReleaseHistory({
	releases,
	users,
	currency,
	rate,
}: {
	releases: FundRelease[];
	users: User[];
	currency: CurrencyCode;
	/** 1 local unit = `rate` USD, for converting the stored USD amount to local. */
	rate: number;
}) {
	const local = (usd: number) => formatMoney(usdToLocal(usd, rate), currency);

	const columns: Column<FundRelease>[] = [
		{
			key: "date",
			header: "Release date",
			render: (r) => formatDate(r.releaseDate),
		},
		{
			key: "amount",
			header: `Amount (${currency})`,
			align: "right",
			render: (r) => <span className="font-semibold">{local(r.amountUsd)}</span>,
		},
		{
			key: "note",
			header: "Note",
			render: (r) => (
				<span className="text-[var(--color-muted)]">{r.note ?? "—"}</span>
			),
		},
		{
			key: "by",
			header: "Recorded by",
			render: (r) => userById(users, r.createdByUserId)?.name ?? "—",
		},
	];

	return (
		<SectionCard title="Fund release history">
			<DataTable
				columns={columns}
				rows={releases}
				getKey={(r) => r.id}
				empty={
					<EmptyState
						title="No releases yet"
						description="Fund releases from HQ will appear here."
					/>
				}
			/>
		</SectionCard>
	);
}
