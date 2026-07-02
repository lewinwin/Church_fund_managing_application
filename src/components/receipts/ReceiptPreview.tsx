import { FileText, ImageOff } from "lucide-react";

// Renders the uploaded receipt. Images show inline; PDFs embed; missing files
// show a placeholder. Data URLs are held client-side only in W1.
export function ReceiptPreview({
	dataUrl,
	fileName,
	height = 240,
}: {
	dataUrl: string | null;
	fileName: string | null;
	height?: number;
}) {
	const isImage = dataUrl?.startsWith("data:image");
	const isPdf =
		dataUrl?.startsWith("data:application/pdf") ||
		fileName?.toLowerCase().endsWith(".pdf");

	if (dataUrl && isImage) {
		return (
			<img
				src={dataUrl}
				alt={fileName ?? "Receipt"}
				className="w-full rounded-xl border border-[var(--color-line)] object-contain"
				style={{ maxHeight: height }}
			/>
		);
	}

	if (dataUrl && isPdf) {
		return (
			<embed
				src={dataUrl}
				type="application/pdf"
				className="w-full rounded-xl border border-[var(--color-line)]"
				style={{ height }}
			/>
		);
	}

	return (
		<div
			className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-muted)]"
			style={{ height }}
		>
			{fileName ? (
				<>
					<FileText size={26} />
					<p className="text-sm font-medium text-[var(--color-ink)]">
						{fileName}
					</p>
					<p className="text-xs">Preview not stored for seed receipts</p>
				</>
			) : (
				<>
					<ImageOff size={26} />
					<p className="text-sm">No receipt file attached</p>
				</>
			)}
		</div>
	);
}
