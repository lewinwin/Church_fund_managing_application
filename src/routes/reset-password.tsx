import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Coins } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button, Field, Input } from "#/components/ui/primitives";

export const Route = createFileRoute("/reset-password")({
	component: ResetPasswordPage,
});

// UI-only in W1 — no password is actually changed.
function ResetPasswordPage() {
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [done, setDone] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (password.length < 6) {
			setError("Password must be at least 6 characters.");
			return;
		}
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		setError(null);
		setDone(true);
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

				{done ? (
					<div className="card p-6 text-center">
						<div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e4f4ea] text-[var(--color-positive)]">
							<CheckCircle2 size={22} />
						</div>
						<h1 className="text-xl font-bold">Password updated</h1>
						<p className="mt-2 text-sm text-[var(--color-muted)]">
							You can now log in with your new password.
						</p>
						<p className="mt-3 rounded-lg bg-[var(--color-forest-50)] px-3 py-2 text-xs text-[var(--color-muted)]">
							Prototype note: this screen is UI-only in Week 1.
						</p>
						<Link to="/login" className="mt-4 inline-block">
							<Button className="w-full">Back to login</Button>
						</Link>
					</div>
				) : (
					<>
						<h1 className="text-2xl font-bold tracking-tight">
							Reset password
						</h1>
						<p className="mt-1 text-sm text-[var(--color-muted)]">
							Choose a new password for your account.
						</p>
						<form onSubmit={handleSubmit} className="mt-6 space-y-4">
							<Field label="New password">
								<Input
									type="password"
									placeholder="••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
								/>
							</Field>
							<Field label="Confirm password">
								<Input
									type="password"
									placeholder="••••••••"
									value={confirm}
									onChange={(e) => setConfirm(e.target.value)}
									required
								/>
							</Field>
							{error && (
								<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
									{error}
								</p>
							)}
							<Button type="submit" className="w-full">
								Update password
							</Button>
						</form>
					</>
				)}

				<Link
					to="/login"
					className="mt-6 block text-center text-sm font-medium text-[var(--color-forest-700)] hover:underline"
				>
					Back to login
				</Link>
			</div>
		</div>
	);
}
