import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Coins, Eye, EyeOff } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button, Field, Input } from "#/components/ui/primitives";
import { useAuth } from "#/lib/auth/auth";

export const Route = createFileRoute("/login")({ component: LoginPage });

const DEMO_ACCOUNTS = [
	{ email: "hq@example.com", label: "HQ Admin" },
	{ email: "singapore@example.com", label: "Singapore" },
	{ email: "malawi@example.com", label: "Malawi" },
	{ email: "southafrica@example.com", label: "South Africa" },
	{ email: "costarica@example.com", label: "Costa Rica" },
];

function LoginPage() {
	const { login, user, ready } = useAuth();
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Already signed in → skip the form.
	useEffect(() => {
		if (ready && user) navigate({ to: "/dashboard" });
	}, [ready, user, navigate]);

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		const result = login(email, password);
		if (result.ok) {
			navigate({ to: "/dashboard" });
		} else {
			setError(result.error ?? "Login failed.");
		}
	}

	function quickFill(demoEmail: string) {
		setEmail(demoEmail);
		setPassword("demo123");
		setError(null);
	}

	return (
		<div className="grid min-h-screen lg:grid-cols-2">
			{/* Brand panel */}
			<div className="relative hidden overflow-hidden bg-[var(--color-forest-900)] lg:flex lg:flex-col lg:justify-between lg:p-12">
				{/* Church backdrop — save your photo to public/church.jpg */}
				<img
					src="/church.jpg"
					alt=""
					aria-hidden="true"
					onError={(e) => {
						e.currentTarget.style.display = "none";
					}}
					className="pointer-events-none absolute inset-0 h-full w-full object-cover"
				/>
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"linear-gradient(180deg, rgba(18,53,43,0.30) 0%, rgba(18,53,43,0.45) 100%)",
					}}
				/>
				<div
					className="pointer-events-none absolute inset-0 opacity-25"
					style={{
						backgroundImage:
							"radial-gradient(circle at 20% 20%, rgba(163,224,97,0.5), transparent 45%), radial-gradient(circle at 80% 70%, rgba(76,158,119,0.55), transparent 50%)",
					}}
				/>
				<div className="relative flex items-center gap-3 text-white">
					<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-lime-400)] text-[var(--color-forest-900)]">
						<Coins size={22} />
					</span>
					<span className="text-lg font-bold">611 Petty Cash</span>
				</div>

				<div className="relative max-w-md text-white">
					<h2 className="text-3xl font-bold leading-tight">
						Every branch. Every receipt.
						<br />
						One clear view in USD.
					</h2>
					<p className="mt-4 text-[var(--color-forest-100)]">
						Upload receipts, track fund balances in local currency, and give HQ
						real-time oversight across all church branches.
					</p>
				</div>

				<div className="relative flex gap-6 text-white">
					{[
						["4", "Branches"],
						["USD", "HQ view"],
						["OCR", "Assisted entry"],
					].map(([big, small]) => (
						<div key={small}>
							<p className="text-2xl font-bold text-[var(--color-lime-300)]">
								{big}
							</p>
							<p className="text-xs text-[var(--color-forest-100)]">{small}</p>
						</div>
					))}
				</div>
			</div>

			{/* Form panel */}
			<div className="flex items-center justify-center bg-[var(--color-canvas)] px-5 py-10">
				<div className="w-full max-w-sm">
					<div className="mb-8 flex items-center gap-2.5 lg:hidden">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-forest-800)] text-[var(--color-lime-400)]">
							<Coins size={20} />
						</span>
						<span className="font-bold">611 Petty Cash</span>
					</div>

					<h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
					<p className="mt-1 text-sm text-[var(--color-muted)]">
						Log in to your branch or HQ account.
					</p>

					<form onSubmit={handleSubmit} className="mt-6 space-y-4">
						<Field label="Email">
							<Input
								type="email"
								autoComplete="username"
								placeholder="you@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</Field>

						<Field label="Password">
							<div className="relative">
								<Input
									type={showPassword ? "text" : "password"}
									autoComplete="current-password"
									placeholder="••••••••"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
								/>
								<button
									type="button"
									onClick={() => setShowPassword((v) => !v)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
									aria-label={showPassword ? "Hide password" : "Show password"}
								>
									{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
								</button>
							</div>
						</Field>

						<div className="flex items-center justify-between text-sm">
							<label className="flex items-center gap-2 text-[var(--color-muted)]">
								<input
									type="checkbox"
									className="accent-[var(--color-forest-700)]"
								/>
								Remember me
							</label>
							<Link
								to="/forgot-password"
								className="font-medium text-[var(--color-forest-700)] hover:underline"
							>
								Forgot password?
							</Link>
						</div>

						{error && (
							<p className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm text-[var(--color-negative)]">
								{error}
							</p>
						)}

						<Button type="submit" className="w-full">
							Log in
						</Button>
					</form>

					<div className="mt-6">
						<p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
							Demo accounts · password{" "}
							<span className="font-mono">demo123</span>
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							{DEMO_ACCOUNTS.map((a) => (
								<button
									key={a.email}
									type="button"
									onClick={() => quickFill(a.email)}
									className="rounded-lg border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--color-forest-700)] hover:bg-[var(--color-forest-50)]"
								>
									{a.label}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
