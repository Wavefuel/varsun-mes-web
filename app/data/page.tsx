"use client";

import React, { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SearchFilterBar from "@/components/SearchFilterBar";
import EmptyState from "@/components/EmptyState"; // Import EmptyState
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useData } from "@/context/DataContext";

import { fetchDeviceList, type DeviceSummary } from "@/utils/scripts";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Helper for deterministic random numbers
function getPseudoRandom(seed: string) {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (hash << 5) - hash + seed.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

export default function EventsPage() {
	const { currentDate, setCurrentDate } = useData();
	const [searchQuery, setSearchQuery] = useState("");
	const [showFilters, setShowFilters] = useState(false);
	const [devices, setDevices] = useState<DeviceSummary[]>([]);

	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID ?? "";

	React.useEffect(() => {
		if (!lhtClusterId) return;
		fetchDeviceList({ clusterId: lhtClusterId }).then(setDevices).catch(console.error);
	}, [lhtClusterId]);

	// Filter Logic
	const filteredMachines = devices.filter((m) => {
		const query = searchQuery.toLowerCase();
		const name = m.deviceName || m.id;
		return name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query) || (m.serialNumber || "").toLowerCase().includes(query);
	});

	// Helper to generate dynamic status based on machine + date
	const getMachineStatus = (machineId: string, date: string) => {
		const rand = getPseudoRandom(machineId + date);
		const untaggedCount = rand % 25; // 0 to 24

		// Simulate different states based on random seed
		const statusTypes = ["Running", "Idle", "Maintenance", "Offline"];
		// Bias towards 'Running'
		const statusIndex = rand % 10 > 6 ? rand % 4 : 0;
		const status = statusTypes[statusIndex];

		// Connection strength (1-3)
		const connectionParams = {
			signal: 80 + (rand % 20), // 80-99%
			ping: 12 + (rand % 40), // 12-52ms
		};

		return { untaggedCount, status, ...connectionParams };
	};

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard pb-24">
			<AppHeader title="Events" subtitle="Device Metrics" showDateNavigator={true} />

			{/* Sticky Controls Container */}
			<div className="sticky top-[var(--header-height-expanded)] z-20 bg-background-dashboard pb-3 px-4">
				{/* Search & Filter Row */}
				<SearchFilterBar
					className="mt-3"
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					placeholder="Search machines..."
					showFilters={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
				/>
			</div>

			{/* Machines List */}
			<main className="px-4 space-y-2 flex-1 flex flex-col">
				{filteredMachines.map((machine) => {
					const { untaggedCount, status, signal } = getMachineStatus(machine.id, currentDate);
					const isOnline = status !== "Offline";

					return (
						<Link
							key={machine.id}
							href={`/data/${encodeURIComponent(machine.id)}`}
							className="planning-card border-card-border active:scale-[0.99] hover:border-card-border"
						>
							<div className="flex justify-between items-start gap-4">
								{/* Left Column */}
								<div className="flex flex-col gap-0.5 flex-1">
									{/* Primary ID + Status Dot */}
									<div className="flex items-center gap-2">
										<h3 className="list-title">{machine.deviceName || machine.id}</h3>
										<div
											className={cn(
												"size-2 rounded-full",
												status === "Running"
													? "bg-emerald-500"
													: status === "Idle"
														? "bg-amber-500"
														: status === "Maintenance"
															? "bg-blue-500"
															: "bg-gray-300",
											)}
										/>
									</div>

									{/* Secondary Name */}
									<p className="list-subtext">
										{machine.foreignId || machine.id}
									</p>

									{/* Serial Number */}
									<p className="list-subtext">{machine.serialNumber || "No S/N"}</p>
								</div>

								{/* Right Column: Just the Call-to-action Metric */}
								<div className="list-metric-column">
									<span
										className={cn(
											"list-tag",
											untaggedCount > 0 ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50",
										)}
									>
										{untaggedCount} Untagged
									</span>
								</div>
							</div>
						</Link>
					);
				})}

				{/* Empty State */}
				{filteredMachines.length === 0 && (
					<div className="flex-1 flex flex-col items-center justify-center -mt-20">
						<EmptyState icon="dns" title="No Devices Found" description="No machines match your current search criteria." />
					</div>
				)}
			</main>
		</div>
	);
}
