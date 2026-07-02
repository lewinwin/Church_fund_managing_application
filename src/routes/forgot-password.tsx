import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Coins, MailCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button, Field, Input } from "#/components/ui/primitives";

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPasswordPage,
});

// UI-only in W1 — no reset email is actually sent.
function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setSent(true);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-5 py-10">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex items-center gap-2.5">
					<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-forest-800)] text-[var(--color-lime-400)]">
						<Coins size={20} />
					</span>
					<span className="font-bold">611 Petty Cash</span>
				</div>

				{sent ? (
					<div className="card p-6 text-center">
						<div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e4f4ea] text-[var(--color-positive)]">
							<MailCheck size={22} />
						</div>
						<h1 className="text-xl font-bold">Check your inbox</h1>
						<p className="mt-2 text-sm text-[var(--color-muted)]">
							If an account exists for{" "}
							<span className="font-medium text-[var(--color-ink)]">
								{email || "that address"}
							</span>
							, we've sent a reset link.
						</p>
						<p className="mt-3 rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
							Prototype note: email delivery is stubbed in Week 1.
						</p>
						<Link to="/reset-password" className="mt-4 inline-block">
							<Button variant="ghost">Continue to reset screen</Button>
						</Link>
					</div>
				) : (
					<>
						<h1 className="text-2xl font-bold tracking-tight">
							Forgot password?
						</h1>
						<p className="mt-1 text-sm text-[var(--color-muted)]">
							Enter your email and we'll send you a reset link.
						</p>
						<form onSubmit={handleSubmit} className="mt-6 space-y-4">
							<Field label="Email">
								<Input
									type="email"
									placeholder="you@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
								/>
							</Field>
							<Button type="submit" className="w-full">
								Send reset link
							</Button>
						</form>
					</>
				)}

				<Link
					to="/login"
					className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-[var(--color-forest-700)] hover:underline"
				>
					<ArrowLeft size={15} /> Back to login
				</Link>
			</div>
		</div>
	);
}
