// Visual badge for an expense's OCR-verification status. `ok` renders nothing
// (a passed transaction shows normally), so this can be dropped into any row.
import type { ReviewStatus } from "#/lib/types";

interface Meta {
	label: string;
	/** Tailwind classes for the pill. */
	className: string;
	strike?: boolean;
}

const META: Record<ReviewStatus, Meta | null> = {
	ok: null, // passed verification — shows normally, no badge
	checking: { label: "Checking…", className: "bg-[#eef1f0] text-[#5b6b64]" },
	need_check: {
		label: "Need to Check",
		className: "bg-[#fbf1dd] text-[#b7841f]",
	},
	cancelled: {
		label: "Cancelled",
		className: "bg-[#f1f2f2] text-[#8a8f8d]",
		strike: true,
	},
	modify_requested: {
		label: "Returned",
		className: "bg-[#e7eefb] text-[#2f5bb7]",
	},
	after_modify_check: {
		label: "After Modify Check",
		className: "bg-[#efe7fb] text-[#6b3fb7]",
	},
	correct_modification: {
		label: "Correct modification",
		className: "bg-[#e4f4ea] text-[var(--color-positive)]",
	},
};

export function reviewStatusLabel(status: ReviewStatus): string {
	return META[status]?.label ?? "OK";
}

export function ReviewBadge({ status }: { status: ReviewStatus }) {
	const meta = META[status];
	if (!meta) return null;
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className} ${
				meta.strike ? "line-through" : ""
			}`}
		>
			<span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
			{meta.label}
		</span>
	);
}
