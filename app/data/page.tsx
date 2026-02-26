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

import { fetchDeviceList } from "@/utils/scripts";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
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
	const { eventsDevices, setEventsDevices } = useData();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState("All");
	const [filterConnection, setFilterConnection] = useState("All");
	const [showFilters, setShowFilters] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

	React.useEffect(() => {
		if (eventsDevices.length > 0) return;

		if (isError) return;

		setIsLoading(true);
		fetchDeviceList({})
			.then(setEventsDevices)
			.catch((e) => {
				console.error(e);
				setIsError(true);
			})
			.finally(() => setIsLoading(false));
	}, [eventsDevices.length, setEventsDevices, isError]);

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
			{/* Floating Action Menu */}
			<div className="fixed bottom-[74px] left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] pointer-events-none flex flex-col items-end gap-3 pr-4">
				<div
					className={cn(
						"flex flex-col items-end gap-3 transition-all duration-200",
						isFabMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
					)}
				>
					<Link
						href="/data/bulk-upload"
						onClick={() => setIsFabMenuOpen(false)}
						className="pointer-events-auto size-12 rounded-full bg-primary/90 text-white shadow-xl shadow-primary/20 hover:scale-105 hover:bg-primary active:scale-95 transition-all flex items-center justify-center backdrop-blur-sm"
						title="Bulk Upload Event Reasons"
					>
						<span className="material-symbols-outlined text-[22px]">file_upload</span>
					</Link>
					<Link
						href="/data/bulk-download"
						onClick={() => setIsFabMenuOpen(false)}
						className="pointer-events-auto size-12 rounded-full bg-primary/90 text-white shadow-xl shadow-primary/20 hover:scale-105 hover:bg-primary active:scale-95 transition-all flex items-center justify-center backdrop-blur-sm"
						title="Bulk Download Events"
					>
						<span className="material-symbols-outlined text-[22px]">file_download</span>
					</Link>
					<Link
						href="/data/bulk-edit"
						onClick={() => setIsFabMenuOpen(false)}
						className="pointer-events-auto size-12 rounded-full bg-primary/90 text-white shadow-xl shadow-primary/20 hover:scale-105 hover:bg-primary active:scale-95 transition-all flex items-center justify-center backdrop-blur-sm"
						title="Bulk Edit Events"
					>
						<span className="material-symbols-outlined text-[22px]">edit_note</span>
					</Link>
				</div>

				<button
					type="button"
					onClick={() => setIsFabMenuOpen((prev) => !prev)}
					className="pointer-events-auto size-12 rounded-full bg-primary/90 text-white shadow-xl shadow-primary/20 hover:scale-105 hover:bg-primary active:scale-95 transition-all flex items-center justify-center backdrop-blur-sm"
					title={isFabMenuOpen ? "Close Menu" : "Open Menu"}
					aria-label={isFabMenuOpen ? "Close menu" : "Open menu"}
				>
					<span className={cn("material-symbols-outlined text-[22px] transition-transform", isFabMenuOpen && "rotate-90")}>
						{isFabMenuOpen ? "close" : "menu"}
					</span>
				</button>
			</div>
		</div>
	);
}
