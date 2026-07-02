// Modal (centered dialog) and Drawer (right slide-over). Both close on Escape
// and backdrop click. Rendered inline (no portal) — fine for the prototype.

import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { cx } from "./primitives";

function useEscape(open: boolean, onClose: () => void) {
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, onClose]);
}

export function Modal({
	open,
	onClose,
	title,
	children,
	footer,
	width = "max-w-lg",
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	width?: string;
}) {
	useEscape(open, onClose);
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="Close"
				className="absolute inset-0 bg-[rgba(18,53,43,0.4)] backdrop-blur-sm"
				onClick={onClose}
			/>
			<div
				className={cx(
					"relative z-10 w-full overflow-hidden rounded-2xl bg-white shadow-xl",
					width,
				)}
			>
				<div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
					<h3 className="text-base font-semibold">{title}</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-forest-50)]"
					>
						<X size={18} />
					</button>
				</div>
				<div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
				{footer && (
					<div className="flex justify-end gap-2 border-t border-[var(--color-line)] bg-[var(--color-canvas)] px-5 py-3">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}

export function Drawer({
	open,
	onClose,
	title,
	children,
	width = "max-w-md",
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	width?: string;
}) {
	useEscape(open, onClose);
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50">
			<button
				type="button"
				aria-label="Close"
				className="absolute inset-0 bg-[rgba(18,53,43,0.4)] backdrop-blur-sm"
				onClick={onClose}
			/>
			<div
				className={cx(
					"absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-2xl",
					width,
				)}
			>
				<div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
					<h3 className="text-base font-semibold">{title}</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-forest-50)]"
					>
						<X size={18} />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
			</div>
		</div>
	);
}
