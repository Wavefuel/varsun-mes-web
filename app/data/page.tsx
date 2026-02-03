"use client";

import React, { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SearchFilterBar from "@/components/SearchFilterBar";
import EmptyState from "@/components/EmptyState"; // Import EmptyState
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Loader from "@/components/Loader";
import Select from "@/components/ui/Select";
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

// Helper to determine status colors
function getStatusStyles(status: string = "") {
	const s = status.toUpperCase();

	// Green - Active/Good
	if (["ACTIVE", "RUNNING", "ONLINE", "CHARGING", "FINISHING"].includes(s)) {
		return "text-emerald-700 bg-emerald-50 border border-emerald-200/50";
	}

	// Blue - Ready/Info
	if (["AVAILABLE", "STANDBY", "PREPARING"].includes(s)) {
		return "text-blue-700 bg-blue-50 border border-blue-200/50";
	}

	// Amber - Warning/Pause
	if (["IDLE", "PENDING", "SUSPENDEDEVSE", "SUSPENDEDEV", "RESERVED"].includes(s)) {
		return "text-amber-700 bg-amber-50 border border-amber-200/50";
	}

	// Orange - Maintenance
	if (["MAINTENANCE"].includes(s)) {
		return "text-orange-700 bg-orange-50 border border-orange-200/50";
	}

	// Red - Error/Critical
	if (["ERROR", "FAULTED", "UNAVAILABLE"].includes(s)) {
		return "text-red-700 bg-red-50 border border-red-200/50";
	}

	// Gray - Inactive/Unknown/Default
	return "text-gray-600 bg-gray-100 border border-gray-200/50";
}

export default function EventsPage() {
	const { currentDate, eventsDevices, setEventsDevices, currentShift } = useData();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState("All");
	const [filterConnection, setFilterConnection] = useState("All");
	const [showFilters, setShowFilters] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);

	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID ?? "";

	React.useEffect(() => {
		if (!lhtClusterId) return;
		if (eventsDevices.length > 0) return;

		if (isError) return;

		setIsLoading(true);
		fetchDeviceList({ clusterId: lhtClusterId })
			.then(setEventsDevices)
			.catch((e) => {
				console.error(e);
				setIsError(true);
			})
			.finally(() => setIsLoading(false));
	}, [lhtClusterId, eventsDevices.length, setEventsDevices, isError]);

	const filteredMachines = eventsDevices.filter((m) => {
		const query = searchQuery.toLowerCase();
		const name = m.deviceName || m.id;
		const matchesSearch =
			name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query) || (m.serialNumber || "").toLowerCase().includes(query);

		const matchesStatus = filterStatus === "All" || (m.deviceStatus || "N/A") === filterStatus;
		const matchesConnection = filterConnection === "All" || (m.connectionStatus || "N/A") === filterConnection;

		return matchesSearch && matchesStatus && matchesConnection;
	});

	const statusOptions = React.useMemo(() => {
		const statuses = Array.from(new Set(eventsDevices.map((d) => d.deviceStatus || "N/A"))).sort();
		return ["All", ...statuses];
	}, [eventsDevices]);

	const connectionOptions = React.useMemo(() => {
		const statuses = Array.from(new Set(eventsDevices.map((d) => d.connectionStatus || "N/A"))).sort();
		return ["All", ...statuses];
	}, [eventsDevices]);

	// Helper to generate dynamic status based on machine + date + shift
	const getMachineStatus = (machineId: string, date: string, shift: string) => {
		const rand = getPseudoRandom(machineId + date + shift);
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
					onToggleFilters={() => {
						if (showFilters) {
							setFilterStatus("All");
							setFilterConnection("All");
						}
						setShowFilters(!showFilters);
					}}
				/>

				{showFilters && (
					<div className="mt-2 animate-in slide-in-from-top-1 fade-in duration-200 grid grid-cols-2 gap-3 items-end">
						<div>
							<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Device Status</p>
							<div className="relative">
								<Select
									value={filterStatus}
									onChange={setFilterStatus}
									options={statusOptions}
									placeholder="All"
									className="w-full h-8 bg-white rounded-md text-xs"
								/>
							</div>
						</div>

						<div>
							<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Connection</p>
							<div className="relative">
								<Select
									value={filterConnection}
									onChange={setFilterConnection}
									options={connectionOptions}
									placeholder="All"
									className="w-full h-8 bg-white rounded-md text-xs"
								/>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Machines List */}
			<main className="px-4 space-y-2 flex-1 flex flex-col">
				{isError ? (
					<div className="flex-1 flex flex-col items-center justify-center -mt-20">
						<EmptyState
							icon="cloud_off"
							title="Connection Failed"
							description={
								<span>
									Unable to retrieve device data. <br />
									<span className="text-gray-400 text-xs mt-1 block">Please check your connection.</span>
								</span>
							}
							action={
								<button
									onClick={() => setIsError(false)}
									className="mt-2 h-9 px-6 rounded-lg bg-primary text-white font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-wide"
								>
									Retry
								</button>
							}
						/>
					</div>
				) : isLoading && !eventsDevices.length ? (
					<div className="flex-1 flex flex-col justify-center select-none min-h-[50vh]">
						<Loader />
					</div>
				) : (
					<>
						{filteredMachines.map((machine) => {
							const { untaggedCount, status, signal } = getMachineStatus(machine.id, currentDate, currentShift);
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
												<h3 className="list-title">{machine.deviceName || "N/A"}</h3>
												<div
													className={cn(
														"size-2 rounded-full",
														machine.connectionStatus === "ONLINE" ? "bg-emerald-500" : "bg-red-400",
													)}
												/>
											</div>

											{/* Serial Number */}
											<p className="list-subtext">{machine.serialNumber || "No S/N"}</p>

											{/* Last Seen */}
											<p className="list-subtext">Last seen {new Date(machine.updatedAt).toLocaleDateString()}</p>
										</div>

										{/* Right Column: Just the Call-to-action Metric */}
										<div className="list-metric-column">
											<span
												className={cn(
													"text-[10px] font-bold px-2.5 py-1 rounded-md tracking-wider uppercase",
													getStatusStyles(machine.deviceStatus),
												)}
											>
												{machine.deviceStatus || "N/A"}
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
					</>
				)}
			</main>
			<Link
				href="/data/bulk-edit"
				className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-200 group"
				title="Bulk Edit Events"
			>
				<span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform">library_add_check</span>
			</Link>
		</div>
	);
}
