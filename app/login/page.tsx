"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { STORAGE_KEY } from "@/components/AuthGuard";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const handleLogin = (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		if (!email || !password) {
			toast.error("Please enter both email and password.");
			setLoading(false);
			return;
		}

		// Simple email validation regex
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			toast.error("Please enter a valid email address.");
			setLoading(false);
			return;
		}

		const configEmail = process.env.NEXT_PUBLIC_LHT_ACCOUNT_EMAIL;
		const configPassword = process.env.NEXT_PUBLIC_LHT_ACCOUNT_PASSWORD;

		// Simulate a slight delay for realism
		setTimeout(() => {
			if (email === configEmail && password === configPassword) {
				localStorage.setItem(STORAGE_KEY, Date.now().toString());
				toast.success("Welcome back!");
				router.push("/");
			} else {
				toast.error("Invalid email address or password. Please try again.");
				setLoading(false);
			}
		}, 800);
	};

	return (
		<div className="flex flex-col min-h-screen items-center justify-center p-6 bg-background-dashboard">
			<div className="w-full max-w-sm flex flex-col items-center">
				<div className="flex flex-col items-center mb-10 text-center">
					<div className="size-16 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
						<span className="material-symbols-outlined text-white !text-4xl leading-none">lightbulb</span>
					</div>
					<h1 className="text-3xl font-bold font-display text-primary tracking-tight">Lighthouse</h1>
					<p className="text-2xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Manufacturing Execution</p>
				</div>
				<div className="w-full bg-white border border-card-border rounded-2xl p-8 card-shadow">
					<h2 className="text-lg font-bold font-display text-primary mb-6">Sign In</h2>
					<form className="space-y-5" onSubmit={handleLogin} noValidate>
						<div>
							<label className="block text-xs-plus font-bold text-gray-500 uppercase tracking-wider mb-2" htmlFor="email">
								Email Address
							</label>
							<input
								className="w-full px-4 py-3 bg-white border border-card-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-gray-400"
								id="email"
								placeholder="name@company.com"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-xs-plus font-bold text-gray-500 uppercase tracking-wider mb-2" htmlFor="password">
								Password
							</label>
							<input
								className="w-full px-4 py-3 bg-white border border-card-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-gray-400"
								id="password"
								placeholder="••••••••"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>
						<button
							className={`w-full bg-primary text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-opacity-90 active:scale-[0.98] transition-all text-sm uppercase tracking-widest mt-2 flex items-center justify-center ${loading ? "opacity-80 cursor-wait" : ""}`}
							type="submit"
							disabled={loading}
						>
							{loading ? <span className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : "Sign In"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
