"use client";

import { useState } from "react";
import { fetchErpSchedule } from "@/app/actions/erp";
import { toast } from "sonner";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

export default function TestErpPage() {
	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleTest = async () => {
		setLoading(true);
		setError(null);
		setData(null);

		try {
			// using a hardcoded valid date from the user's previous example or today
			const testDate = "2026-01-22";
			const result = await fetchErpSchedule(testDate, "D");
			setData(result);
			toast.success("ERP Data fetched successfully!");
		} catch (err: any) {
			console.error(err);
			setError(err.message || "Unknown error");
			toast.error("Failed to fetch ERP data");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard">
			<AppHeader title="ERP Test" subtitle="Connection Verification" showDateNavigator={false} />

			<div className="p-6 flex flex-col gap-6">
				<div className="bg-white p-6 rounded-2xl shadow-sm border border-card-border">
					<h2 className="text-lg font-bold text-primary mb-2">Test ERP Connection</h2>
					<p className="text-sm text-gray-500 mb-6">
						Click the button below to trigger the server-side login flow and fetch schedule data for <b>2026-01-22</b>.
					</p>

					<button
						onClick={handleTest}
						disabled={loading}
						className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-md hover:bg-opacity-90 transition-all disabled:opacity-50"
					>
						{loading ? "Connecting..." : "Test ERP Fetch"}
					</button>

					{error && (
						<div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
							<strong>Error:</strong> {error}
						</div>
					)}
				</div>

				{data && (
					<div className="bg-white p-6 rounded-2xl shadow-sm border border-card-border overflow-hidden">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-sm font-bold text-gray-700">Response Data</h3>
							<span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold">
								{Array.isArray(data) ? `${data.length} Records` : "Object"}
							</span>
						</div>
						<pre className="bg-gray-50 p-4 rounded-xl text-[10px] overflow-auto max-h-[400px] border border-gray-100 text-gray-600 font-mono">
							{JSON.stringify(data, null, 2)}
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}
