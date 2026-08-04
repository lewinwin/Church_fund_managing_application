import { FileText, ImageOff, Maximize2, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

// Fullscreen overlay used by both the image and PDF expand views.
function Lightbox({
	onClose,
	children,
}: {
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(12,20,17,0.85)] p-4 backdrop-blur-sm">
			<button
				type="button"
				aria-label="Close receipt preview"
				onClick={onClose}
				className="absolute inset-0"
			/>
			<button
				type="button"
				aria-label="Close receipt preview"
				onClick={onClose}
				className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
			>
				<X size={22} />
			</button>
			{children}
		</div>
	);
}

// Renders the uploaded receipt. Images show inline; PDFs embed. Both get a
// click-to-expand lightbox (receipts are often tiny and hard to read) — the PDF
// lightbox also offers "Open in new tab" for the browser's full viewer. Missing
// files show a placeholder.
export function ReceiptPreview({
	dataUrl,
	fileName,
	height = 240,
	zoomable = true,
}: {
	dataUrl: string | null;
	fileName: string | null;
	height?: number;
	/** Show the expand icon + click-to-zoom lightbox. */
	zoomable?: boolean;
}) {
	const [zoomed, setZoomed] = useState(false);
	// `dataUrl` may be a data: URL (submit-time preview) or a presigned https URL
	// (a stored receipt). PDFs are detected by prefix or filename; anything else
	// with a src is treated as an image.
	const isPdf =
		dataUrl?.startsWith("data:application/pdf") ||
		fileName?.toLowerCase().endsWith(".pdf");
	const isImage = !!dataUrl && !isPdf;

	// Close the lightbox on Escape.
	useEffect(() => {
		if (!zoomed) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoomed(false);
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [zoomed]);

	const expandButton = zoomable ? (
		<button
			type="button"
			onClick={() => setZoomed(true)}
			aria-label="Expand receipt"
			title="Expand receipt"
			className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(18,53,43,0.55)] text-white opacity-80 backdrop-blur transition hover:opacity-100"
		>
			<Maximize2 size={16} />
		</button>
	) : null;

	if (dataUrl && isImage) {
		return (
			<>
				<div className="group relative">
					<img
						src={dataUrl}
						alt={fileName ?? "Receipt"}
						onClick={zoomable ? () => setZoomed(true) : undefined}
						className={`w-full rounded-xl border border-[var(--color-line)] object-contain ${
							zoomable ? "cursor-zoom-in" : ""
						}`}
						style={{ maxHeight: height }}
					/>
					{expandButton}
				</div>

				{zoomed && (
					<Lightbox onClose={() => setZoomed(false)}>
						<img
							src={dataUrl}
							alt={fileName ?? "Receipt"}
							className="relative z-10 max-h-[92vh] rounded-lg object-contain shadow-2xl"
							style={{ width: "min(92vw, 720px)" }}
						/>
					</Lightbox>
				)}
			</>
		);
	}

	if (dataUrl && isPdf) {
		return (
			<>
				<div className="relative">
					<embed
						src={dataUrl}
						type="application/pdf"
						className="w-full rounded-xl border border-[var(--color-line)]"
						style={{ height }}
					/>
					{expandButton}
				</div>

				{zoomed && (
					<Lightbox onClose={() => setZoomed(false)}>
						<div
							className="relative z-10 flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
							style={{ width: "min(92vw, 900px)", height: "92vh" }}
						>
							<div className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] px-3 py-2">
								<span className="truncate text-sm font-medium text-[var(--color-ink)]">
									{fileName ?? "Receipt.pdf"}
								</span>
								<a
									href={dataUrl}
									target="_blank"
									rel="noreferrer"
									className="shrink-0 text-xs font-medium text-[var(--color-forest-700)] hover:underline"
								>
									Open in new tab
								</a>
							</div>
							<embed
								src={dataUrl}
								type="application/pdf"
								className="min-h-0 flex-1"
							/>
						</div>
					</Lightbox>
				)}
			</>
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
