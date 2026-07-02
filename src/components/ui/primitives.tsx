// Shared UI primitives. Small, unopinionated building blocks styled via the
// design tokens in styles.css.
import type {
	ButtonHTMLAttributes,
	InputHTMLAttributes,
	ReactNode,
	SelectHTMLAttributes,
	TextareaHTMLAttributes,
} from "react";
import type { BalanceStatus } from "#/lib/types";

export function cx(...parts: Array<string | false | null | undefined>): string {
	return parts.filter(Boolean).join(" ");
}

// --------------------------------------------------------------------------
// Card
// --------------------------------------------------------------------------

export function Card({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return <div className={cx("card", className)}>{children}</div>;
}

export function SectionCard({
	title,
	action,
	className,
	bodyClassName,
	children,
}: {
	title?: ReactNode;
	action?: ReactNode;
	className?: string;
	bodyClassName?: string;
	children: ReactNode;
}) {
	return (
		<Card className={cx("p-5", className)}>
			{(title || action) && (
				<div className="mb-4 flex items-center justify-between gap-3">
					{typeof title === "string" ? (
						<h3 className="text-base font-semibold text-[var(--color-ink)]">
							{title}
						</h3>
					) : (
						title
					)}
					{action}
				</div>
			)}
			<div className={bodyClassName}>{children}</div>
		</Card>
	);
}

// --------------------------------------------------------------------------
// Button
// --------------------------------------------------------------------------

type Variant = "primary" | "accent" | "ghost" | "danger";

export function Button({
	variant = "primary",
	className,
	children,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
	const variantClass = {
		primary: "btn-primary",
		accent: "btn-accent",
		ghost: "btn-ghost",
		danger: "btn-danger",
	}[variant];
	return (
		<button
			type="button"
			className={cx("btn", variantClass, className)}
			{...props}
		>
			{children}
		</button>
	);
}

// --------------------------------------------------------------------------
// Badge / status
// --------------------------------------------------------------------------

export function Badge({
	tone = "neutral",
	children,
}: {
	tone?: "neutral" | "green" | "red" | "amber" | "lime";
	children: ReactNode;
}) {
	const tones: Record<string, string> = {
		neutral: "bg-[var(--color-forest-50)] text-[var(--color-forest-700)]",
		green: "bg-[#e4f4ea] text-[var(--color-positive)]",
		red: "bg-[#fdecea] text-[var(--color-negative)]",
		amber: "bg-[#fbf1dd] text-[#b7841f]",
		lime: "bg-[var(--color-lime-100)] text-[var(--color-forest-800)]",
	};
	return (
		<span
			className={cx(
				"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
				tones[tone],
			)}
		>
			{children}
		</span>
	);
}

const STATUS_TONE: Record<BalanceStatus, "green" | "amber" | "red"> = {
	healthy: "green",
	warning: "amber",
	low: "red",
};
const STATUS_TEXT: Record<BalanceStatus, string> = {
	healthy: "Healthy",
	warning: "Warning",
	low: "Low balance",
};

export function StatusPill({ status }: { status: BalanceStatus }) {
	return (
		<Badge tone={STATUS_TONE[status]}>
			<span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
			{STATUS_TEXT[status]}
		</Badge>
	);
}

// --------------------------------------------------------------------------
// Progress bar
// --------------------------------------------------------------------------

export function ProgressBar({
	value,
	tone = "forest",
	className,
}: {
	/** 0..1 */
	value: number;
	tone?: "forest" | "lime" | "amber" | "red";
	className?: string;
}) {
	const pct = Math.max(0, Math.min(1, value)) * 100;
	const bar: Record<string, string> = {
		forest: "bg-[var(--color-forest-700)]",
		lime: "bg-[var(--color-lime-500)]",
		amber: "bg-[var(--color-warning)]",
		red: "bg-[var(--color-negative)]",
	};
	return (
		<div
			className={cx(
				"h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-forest-50)]",
				className,
			)}
		>
			<div
				className={cx("h-full rounded-full transition-all", bar[tone])}
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
}

// --------------------------------------------------------------------------
// Empty state
// --------------------------------------------------------------------------

export function EmptyState({
	icon,
	title,
	description,
	action,
}: {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-line)] px-6 py-12 text-center">
			{icon && (
				<div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-forest-50)] text-[var(--color-forest-500)]">
					{icon}
				</div>
			)}
			<p className="font-semibold text-[var(--color-ink)]">{title}</p>
			{description && (
				<p className="max-w-sm text-sm text-[var(--color-muted)]">
					{description}
				</p>
			)}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}

// --------------------------------------------------------------------------
// Avatar
// --------------------------------------------------------------------------

export function Avatar({ label, size = 36 }: { label: string; size?: number }) {
	return (
		<div
			className="flex shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-800)] font-semibold text-white"
			style={{ width: size, height: size, fontSize: size * 0.36 }}
		>
			{label}
		</div>
	);
}

// --------------------------------------------------------------------------
// Form fields
// --------------------------------------------------------------------------

export function Field({
	label,
	hint,
	error,
	required,
	children,
}: {
	label?: string;
	hint?: string;
	error?: string;
	required?: boolean;
	children: ReactNode;
}) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in via {children}
		<label className="block">
			{label && (
				<span className="field-label">
					{label}
					{required && <span className="text-[var(--color-negative)]"> *</span>}
				</span>
			)}
			{children}
			{hint && !error && (
				<span className="mt-1 block text-xs text-[var(--color-muted)]">
					{hint}
				</span>
			)}
			{error && (
				<span className="mt-1 block text-xs font-medium text-[var(--color-negative)]">
					{error}
				</span>
			)}
		</label>
	);
}

export function Input({
	className,
	...props
}: InputHTMLAttributes<HTMLInputElement>) {
	return <input className={cx("field-input", className)} {...props} />;
}

export function Select({
	className,
	children,
	...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select className={cx("field-input cursor-pointer", className)} {...props}>
			{children}
		</select>
	);
}

export function Textarea({
	className,
	...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return (
		<textarea className={cx("field-input resize-y", className)} {...props} />
	);
}
