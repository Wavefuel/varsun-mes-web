"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ReasonCodeSelect } from "@/components/ReasonCodeSelect";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useData } from "@/context/DataContext";
import AppHeader from "@/components/AppHeader";
import SearchFilterBar from "@/components/SearchFilterBar";
import Loader from "@/components/Loader";

import { fetchDeviceList, type DeviceSummary } from "@/utils/scripts";
import { fetchDeviceStatusPeriods, DeviceStatusPeriod } from "@/utils/scripts";

export default function MachineTaggingPage() {
	const router = useRouter();
	const params = useParams();
	const { currentDate, setCurrentDate, eventsDevices, setEventsDevices } = useData();
	// decodeURIComponent in case ID has spaces or special chars
	const machineId = typeof params.id === "string" ? decodeURIComponent(params.id) : "Unknown Machine";

	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID ?? "";
	const [isLoading, setIsLoading] = useState(!!lhtClusterId && eventsDevices.length === 0);
	const [isError, setIsError] = useState(false);

	// Fetch devices if not present
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

	const machineName = React.useMemo(() => {
		const device = eventsDevices.find((d) => d.id === machineId);
		return device?.deviceName || machineId;
	}, [eventsDevices, machineId]);

	const [searchQuery, setSearchQuery] = useState("");
	const [showFilters, setShowFilters] = useState(false);
	const [events, setEvents] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const clusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID || "";

	// Fetch device status periods from API
	useEffect(() => {
		const fetchPeriods = async () => {
			try {
				setLoading(true);
				setError(null);

				if (!clusterId) {
					throw new Error("Cluster ID is not configured. Check NEXT_PUBLIC_LHT_CLUSTER_ID in .env");
				}

				if (!machineId || machineId === "Unknown Machine") {
					throw new Error("Invalid machine ID");
				}

				console.log("Fetching status periods for:", { machineId, clusterId, currentDate });

				// Parse currentDate (YYYY-MM-DD format) and create UTC date range
				// IST is UTC+5:30, so to get UTC time from IST, subtract 5.5 hours:
				// IST 2026-01-17 00:00:00 = UTC 2026-01-16 18:30:00
				// IST 2026-01-17 23:59:59 = UTC 2026-01-17 18:29:59
				const [year, month, day] = currentDate.split("-").map(Number);

				// Create UTC dates at midnight for the given day
				const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
				const utcEndOfDay = Date.UTC(year, month - 1, day, 23, 59, 59, 999);

				// Subtract 5.5 hours (IST offset) to get the UTC time that corresponds to IST midnight
				const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
				const fromDateUTC = new Date(utcMidnight - IST_OFFSET_MS);
				const toDateUTC = new Date(utcEndOfDay - IST_OFFSET_MS);

				console.log("Date Conversion Debug:", {
					currentDateString: currentDate,
					parsedValues: { year, month, day },
					utcMidnightTimestamp: utcMidnight,
					utcMidnightISO: new Date(utcMidnight).toISOString(),
					fromDateUTC: fromDateUTC.toISOString(),
					toDateUTC: toDateUTC.toISOString(),
					expectedISTStart: `${currentDate} 00:00:00 IST`,
					expectedISTEnd: `${currentDate} 23:59:59 IST`,
				});

				const result = await fetchDeviceStatusPeriods({
					deviceId: machineId,
					clusterId,
					query: {
						fromDate: fromDateUTC.toISOString(),
						toDate: toDateUTC.toISOString(),
						minDurationMinutes: 15,
					},
				});

				console.log("API Response:", result);

				// Helper function to convert UTC to IST (UTC+5:30)
				const convertUTCToIST = (utcDate: string): string => {
					const date = new Date(utcDate);
					// Use toLocaleString with Asia/Kolkata timezone to get IST time
					return date.toLocaleString("en-US", {
						timeZone: "Asia/Kolkata",
						hour: "2-digit",
						minute: "2-digit",
						hour12: false,
					});
				};

				const mappedEvents = result.data.map((period: DeviceStatusPeriod, index: number) => {
					// For ongoing events, recalculate duration from start to now
					let actualDurationMinutes = period.durationMinutes;
					if (period.isOngoing) {
						const startTime = new Date(period.startTime);
						const now = new Date();
						actualDurationMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
					}

					return {
						id: `period-${index}`,
						machineId: machineId,
						date: currentDate,
						startTime: convertUTCToIST(period.startTime),
						endTime: period.isOngoing ? "now" : convertUTCToIST(period.endTime),
						duration: `${Math.round(actualDurationMinutes)}m`,
						type: period.status,
						durationMinutes: actualDurationMinutes,
					};
				});

				setEvents(mappedEvents);
			} catch (err: any) {
				console.error("Failed to fetch device status periods:", err);
				setError(err.message || "Failed to load device status data");
			} finally {
				setLoading(false);
			}
		};

		if (machineId && clusterId) {
			fetchPeriods();
		}
	}, [machineId, currentDate, clusterId]);

	// Calculate stats from events
	const stats = React.useMemo(() => {
		const runningPeriods = events.filter((e) => e.type === "RUNNING");
		const idlePeriods = events.filter((e) => e.type === "IDLE");
		const offlinePeriods = events.filter((e) => e.type === "OFFLINE");
		const totalRunningMinutes = runningPeriods.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
		const totalIdleMinutes = idlePeriods.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
		const totalOfflineMinutes = offlinePeriods.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

		console.log("Stats Debug:", {
			totalEvents: events.length,
			runningCount: runningPeriods.length,
			totalRunningMinutes,
			idleCount: idlePeriods.length,
			idlePeriods: idlePeriods.map((e) => ({ time: `${e.startTime}-${e.endTime}`, duration: e.durationMinutes })),
			totalIdleMinutes,
			offlineCount: offlinePeriods.length,
			totalOfflineMinutes,
		});

		const formatDuration = (minutes: number) => {
			const hours = Math.floor(minutes / 60);
			const mins = Math.round(minutes % 60);
			return `${hours}h ${mins}m`;
		};

		return {
			totalRunning: formatDuration(totalRunningMinutes),
			totalIdle: formatDuration(totalIdleMinutes),
			totalOffline: formatDuration(totalOfflineMinutes),
		};
	}, [events]);

	// Ensure conditional return is AFTER all hooks
	// Ensure conditional return is AFTER all hooks
	if (isLoading) {
		return (
			<div className="flex bg-background-dashboard min-h-screen items-center justify-center">
				<Loader />
			</div>
		);
	}

	// Removed early return for isError to preserve header

	// Filter Logic
	const filteredEvents = events.filter((e) => {
		const isDateMatch = e.date === currentDate;
		const isSearchMatch =
			e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(e.reason && e.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
			e.startTime.includes(searchQuery);

		return isDateMatch && isSearchMatch;
	});

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard font-display pb-24 text-slate-800">
			<AppHeader
				title={machineName}
				subtitle="DOWNTIME EVENTS"
				showDateNavigator={true}
				rightElement={
					<button
						onClick={() => router.back()}
						className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform"
					>
						Back
					</button>
				}
			/>

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
			) : (
				<main className="!py-2 px-4 space-y-2 pb-24">
					{/* Stats Grid */}
					<section className="grid grid-cols-3 !gap-2">
						<div className="bg-white !rounded-lg border border-gray-100 shadow-sm !px-3 !py-1.5 flex flex-col justify-center items-start min-h-[52px]">
							<p className="!text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Running</p>
							<p className="text-xs font-bold text-gray-800 leading-tight">{stats.totalRunning}</p>
						</div>
						<div className="bg-white !rounded-lg border border-gray-100 shadow-sm !px-3 !py-1.5 flex flex-col justify-center items-start min-h-[52px]">
							<p className="!text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Idle</p>
							<p className="text-xs font-bold text-gray-800 leading-tight">{stats.totalIdle}</p>
						</div>
						<div className="bg-white !rounded-lg border border-gray-100 shadow-sm !px-3 !py-1.5 flex flex-col justify-center items-start min-h-[52px]">
							<p className="!text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Offline</p>
							<p className="text-xs font-bold text-gray-800 leading-tight">{stats.totalOffline}</p>
						</div>
					</section>

					{/* Search Bar */}
					<div className="pb-1">
						<SearchFilterBar
							searchQuery={searchQuery}
							onSearchChange={setSearchQuery}
							placeholder="Search events..."
							showFilters={showFilters}
							onToggleFilters={() => setShowFilters(!showFilters)}
						/>
					</div>

					{/* Event List */}
					<div className="space-y-2">
						{loading ? (
							<div className="text-center py-12 flex flex-col items-center">
								<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mb-2"></div>
								<p className="text-sm font-bold text-gray-400">Loading events...</p>
							</div>
						) : error ? (
							<div className="text-center py-12 flex flex-col items-center">
								<span className="material-symbols-outlined text-[48px] text-red-300 mb-2">error</span>
								<p className="text-sm font-bold text-red-400">{error}</p>
							</div>
						) : filteredEvents.length > 0 ? (
							filteredEvents.map((event) => <EventCard key={event.id} event={event} machineId={machineId} />)
						) : (
							<div className="text-center py-12 flex flex-col items-center opacity-60">
								<span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">event_busy</span>
								<p className="text-sm font-bold text-gray-400">No events found for this date</p>
							</div>
						)}
					</div>
				</main>
			)}
		</div>
	);
}

function EventCard({ event, machineId }: { event: any; machineId: string }) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [reason, setReason] = useState(event.reason || "");

	const eventType = event.type.toUpperCase();

	// Map device states to UI styling
	const getEventStyles = (type: string) => {
		switch (type) {
			case "OFFLINE":
			case "FAULTED":
				return {
					containerClasses: "bg-red-50/50 border-red-200",
					iconName: "power_off",
					iconBg: "bg-red-100",
					iconColor: "text-red-500",
					statusElement: <span className="text-red-600 text-[10px] font-bold uppercase tracking-wider">Offline</span>,
				};
			case "IDLE":
			case "STANDBY":
				return {
					containerClasses: "bg-orange-50/50 border-orange-200",
					iconName: "schedule",
					iconBg: "bg-orange-100",
					iconColor: "text-orange-600",
					statusElement: <span className="text-orange-600 text-[10px] font-bold uppercase tracking-wider">Idle</span>,
				};
			case "MAINTENANCE":
				return {
					containerClasses: "bg-yellow-50/50 border-yellow-200",
					iconName: "build",
					iconBg: "bg-yellow-100",
					iconColor: "text-yellow-600",
					statusElement: <span className="text-yellow-600 text-[10px] font-bold uppercase tracking-wider">Maintenance</span>,
				};
			case "ERROR":
				return {
					containerClasses: "bg-red-50/50 border-red-200",
					iconName: "error",
					iconBg: "bg-red-100",
					iconColor: "text-red-500",
					statusElement: <span className="text-red-600 text-[10px] font-bold uppercase tracking-wider">Error</span>,
				};
			case "RUNNING":
			case "ACTIVE":
				return {
					containerClasses: "bg-green-50/50 border-green-200",
					iconName: "play_circle",
					iconBg: "bg-green-100",
					iconColor: "text-green-600",
					statusElement: <span className="text-green-600 text-[10px] font-bold uppercase tracking-wider">Running</span>,
				};
			default:
				return {
					containerClasses: "bg-gray-50/50 border-gray-200",
					iconName: "info",
					iconBg: "bg-gray-100",
					iconColor: "text-gray-500",
					statusElement: <span className="text-gray-600 text-[10px] font-bold uppercase tracking-wider">{type}</span>,
				};
		}
	};

	const { containerClasses, iconName, iconBg, iconColor, statusElement } = getEventStyles(eventType);
	const isLogged = !!event.reason;

	return (
		<div
			className={cn(
				"rounded-xl border transition-all duration-200",
				containerClasses,
				isExpanded ? "shadow-md ring-1 ring-primary/5" : "shadow-sm",
			)}
		>
			{/* Card Header (Clickable) */}
			<div className="p-2 gap-2 flex cursor-pointer relative" onClick={() => setIsExpanded(!isExpanded)}>
				{/* Icon Box */}
				<div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0 self-center", iconBg, iconColor)}>
					<span className="material-symbols-outlined !text-[16px]">{iconName}</span>
				</div>

				{/* Middle Content */}
				<div className="flex-1 min-w-0 flex flex-col justify-center">
					<h3 className="text-sm font-bold font-display text-slate-800 truncate">
						{eventType}
						{isLogged ? <span className="font-normal text-gray-500"> • {event.reason}</span> : ""}
					</h3>
					<p className="text-[10px] text-slate-500 font-medium truncate">
						{event.startTime} - {event.endTime} • {event.duration}
					</p>
				</div>

				{/* Right Column: Status & Toggle */}
				<div className="flex flex-col items-end justify-between self-stretch shrink-0 pl-1 py-1">
					{statusElement}

					<div className={cn("text-gray-400 transition-transform duration-200 leading-none", isExpanded && "rotate-180")}>
						<span className="material-symbols-outlined !text-[18px]">expand_more</span>
					</div>
				</div>
			</div>

			{/* Expanded Content (Form) */}
			{isExpanded && (
				<div className="bg-white border-t border-gray-100 px-4 py-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
					{/* Reason Code */}
					<div className="space-y-1.5">
						<label className="text-[10px] font-bold text-gray-800 uppercase tracking-wider">Reason Code</label>
						<ReasonCodeSelect value={reason} onChange={setReason} eventType={event.type} />
					</div>

					{/* Action Buttons */}
					<div className="flex justify-between items-center gap-2">
						<Link
							href={`/data/${encodeURIComponent(machineId)}/tag/${event.id}`}
							className="text-xs font-bold text-primary underline decoration-primary/30 hover:decoration-primary underline-offset-2"
						>
							Add more details
						</Link>
						<div className="flex gap-2">
							<button
								onClick={(e) => {
									e.stopPropagation();
									setIsExpanded(false);
								}}
								className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
							>
								CANCEL
							</button>
							<button className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:bg-primary/90 active:scale-95 transition-all">
								SAVE
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
