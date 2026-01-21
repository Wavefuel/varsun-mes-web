"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { clsx } from "clsx";
import { ReasonCodeSelect, getReasonCategory, getReasonDescription } from "@/components/ReasonCodeSelect";
import { toast } from "sonner";
import { CustomToast } from "@/components/CustomToast";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useData } from "@/context/DataContext";
import AppHeader from "@/components/AppHeader";
import SearchFilterBar from "@/components/SearchFilterBar";
import Loader from "@/components/Loader";
import Select from "@/components/ui/Select";

import { fetchDeviceList, type DeviceSummary } from "@/utils/scripts";
import { formatTimeToIST } from "@/utils/dateUtils";
import {
	createDeviceStateEventGroup,
	createDeviceStateEventGroupItems,
	fetchDeviceStatusPeriods,
	readDeviceStateEventGroupsWithItems,
	updateDeviceStateEventGroupItems,
	DeviceStatusPeriod,
	DeviceStateEventItemInput,
	DeviceStateEventItemUpdateInput,
} from "@/utils/scripts";

interface DowntimeEvent {
	id: string;
	machineId: string;
	date: string;
	rawStartTime: string;
	rawEndTime: string;
	startTime: string;
	endTime: string;
	duration: string;
	type: string;
	durationMinutes: number;
	itemId: string | null;
	groupId: string | null;
	reason: string;
	category: string | null;
	notes: string;
	metadataText: string;
	tagsText: string;
	isOngoing: boolean;
}

const formatDuration = (minutes: number) => {
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	if (h > 0) {
		return `${h}h${m > 0 ? ` ${m}min` : ""}`;
	}
	return `${m}min`;
};

const buildUtcRangeFromIstDate = (dateStr: string, currentShift: string) => {
	const [year, month, day] = dateStr.split("-").map(Number);
	const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

	let fromDateUTC: Date;
	let toDateUTC: Date;

	if (currentShift === "Day") {
		// Day Shift: 8 AM to 8 PM IST
		const start = Date.UTC(year, month - 1, day, 8, 0, 0, 0);
		const end = Date.UTC(year, month - 1, day, 20, 0, 0, 0);
		fromDateUTC = new Date(start - IST_OFFSET_MS);
		toDateUTC = new Date(end - IST_OFFSET_MS);
	} else {
		// Night Shift: 8 PM to 8 AM next day IST
		const start = Date.UTC(year, month - 1, day, 20, 0, 0, 0);
		const end = Date.UTC(year, month - 1, day + 1, 8, 0, 0, 0);
		fromDateUTC = new Date(start - IST_OFFSET_MS);
		toDateUTC = new Date(end - IST_OFFSET_MS);
	}

	console.log("Date Conversion Debug:", {
		currentDateString: dateStr,
		parsedValues: { year, month, day },
		fromDateUTC: fromDateUTC.toISOString(),
		toDateUTC: toDateUTC.toISOString(),
		expectedISTStart: `${dateStr} ${currentShift === "Day" ? "08:00" : "20:00"} IST`,
		expectedISTEnd: `${dateStr} ${currentShift === "Day" ? "20:00" : "08:00 (next day)"} IST`,
	});

	return { fromDateUTC, toDateUTC };
};

const normalizeIso = (value?: string | Date | null) => {
	if (!value) return "";
	const parsed = value instanceof Date ? value : new Date(value);
	return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
};

const serializeMetadata = (value: unknown) => {
	if (!value) return "";
	if (typeof value === "string") return value;
	if (typeof value !== "object") return String(value);
	return Object.entries(value as Record<string, unknown>)
		.map(([key, val]) => `${key}:${String(val)}`)
		.join(", ");
};

const parseMetadata = (input: string) => {
	const text = input.trim();
	if (!text) return undefined;
	const entries = text
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.map((pair) => {
			const [rawKey, ...rest] = pair.split(/[:=]/);
			const key = rawKey?.trim();
			const value = rest.join(":").trim();
			return key ? [key, value || ""] : null;
		})
		.filter(Boolean) as Array<[string, string]>;
	if (!entries.length) return undefined;
	return Object.fromEntries(entries);
};

const parseTags = (input: string) =>
	input
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);

export default function MachineTaggingPage() {
	const router = useRouter();
	const params = useParams();
	const { currentDate, setCurrentDate, eventsDevices, setEventsDevices, currentShift } = useData();
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
	const [filterStatus, setFilterStatus] = useState<string>("All");
	const [filterTagged, setFilterTagged] = useState<string>("All");
	const [events, setEvents] = useState<DowntimeEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const clusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID || "";
	// Deduplication ref
	const lastFetchParams = React.useRef<string>("");

	const isFutureDate = React.useMemo(() => {
		const now = new Date();
		// Use local time YYYY-MM-DD
		const todayStr = now.toLocaleDateString("en-CA");

		if (currentDate > todayStr) {
			return true;
		} else if (currentDate < todayStr) {
			return false;
		} else {
			// Same day - check shift start times
			const currentHour = now.getHours();
			if (currentShift.includes("Night")) {
				// Night shift starts at 20:00 (8 PM)
				return currentHour < 20;
			} else {
				// Day shift starts at 08:00 (8 AM)
				return currentHour < 8;
			}
		}
	}, [currentDate, currentShift]);

	// Fetch device status periods from API
	useEffect(() => {
		const fetchPeriods = async () => {
			if (isFutureDate) {
				setEvents([]);
				setLoading(false);
				return;
			}

			// Prevent duplicate calls
			const fetchKey = `${machineId}|${currentDate}|${currentShift}`;
			if (lastFetchParams.current === fetchKey) {
				// console.log("Skipping duplicate fetch for:", fetchKey);
				// Ensure loading is false if we skip
				if (loading) setLoading(false);
				return;
			}
			lastFetchParams.current = fetchKey;

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
				const { fromDateUTC, toDateUTC } = buildUtcRangeFromIstDate(currentDate, currentShift);

				const result = await fetchDeviceStatusPeriods({
					deviceId: machineId,
					clusterId,
					query: {
						fromDate: fromDateUTC.toISOString(),
						toDate: toDateUTC.toISOString(),
						minDurationMinutes: 15,
					},
				});

				const account = {};
				const groups = await readDeviceStateEventGroupsWithItems({
					deviceId: machineId,
					clusterId,
					account,
					query: {
						rangeStart: fromDateUTC.toISOString(),
						rangeEnd: toDateUTC.toISOString(),
					},
				});
				const groupItems = Array.isArray(groups)
					? (groups as any[]).flatMap((group: any) => {
							const items = Array.isArray(group?.Items) ? group.Items : [];
							return items.map((item: any) => ({
								...item,
								groupId: group.id,
								groupTags: Array.isArray(group.tags) ? group.tags : [],
								annotationType: group?.metadata?.annotationType,
							}));
						})
					: [];

				console.log("API Response:", result);

				// Helper function to convert UTC to IST (UTC+5:30)
				const convertUTCToIST = (utcDate: string): string => {
					return formatTimeToIST(utcDate);
				};

				const mappedEvents = result.data.map((period: DeviceStatusPeriod, index: number) => {
					// For ongoing events, recalculate duration from start to now
					let actualDurationMinutes = period.durationMinutes;
					if (period.isOngoing) {
						const startTime = new Date(period.startTime);
						const now = new Date();
						actualDurationMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
					}

					const periodStartIso = normalizeIso(period.startTime);
					const periodEndIso = normalizeIso(period.endTime ?? new Date().toISOString());

					// 1. Prioritize finding an item from an "Event" group
					// STRICT MATCHING: Only consider items from "Event" groups.
					// If not found, we treat it as no event group linked (prevents linking to Production groups).
					const matchedItem = groupItems.find((item: any) => {
						const itemStart = normalizeIso(item.segmentStart);
						const itemEnd = normalizeIso(item.segmentEnd);
						const isEventGroup = item.annotationType === "event";
						return itemStart === periodStartIso && itemEnd === periodEndIso && isEventGroup;
					});
					const reasonCode = matchedItem?.metadata?.reasonCode ?? matchedItem?.notes ?? "";

					const metadataText = serializeMetadata(matchedItem?.metadata);
					const tagsText = Array.isArray(matchedItem?.groupTags) ? matchedItem.groupTags.join(", ") : "";

					return {
						id: `period-${index}`,
						machineId: machineId,
						date: currentDate,
						rawStartTime: period.startTime,
						rawEndTime: period.endTime ?? new Date().toISOString(),
						startTime: convertUTCToIST(period.startTime),
						endTime: period.isOngoing ? "now" : convertUTCToIST(period.endTime),
						duration: formatDuration(actualDurationMinutes),
						type: period.status,
						durationMinutes: actualDurationMinutes,
						itemId: matchedItem?.id ?? null,
						groupId: matchedItem?.groupId ?? null,
						reason: reasonCode ? String(reasonCode) : "",

						category: matchedItem?.category ?? null,
						notes: matchedItem?.notes ?? "",
						metadataText,
						tagsText,
						isOngoing: period.isOngoing,
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
	}, [machineId, currentDate, clusterId, currentShift, isFutureDate]);

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

		return {
			totalRunning: formatDuration(totalRunningMinutes),
			totalIdle: formatDuration(totalIdleMinutes),
			totalOffline: formatDuration(totalOfflineMinutes),
		};
	}, [events]);

	// Removed early return for isError to preserve header

	const statusOptions = React.useMemo(() => {
		const statuses = Array.from(new Set(events.map((e) => e.type)))
			.filter(Boolean)
			.sort();
		return ["All", ...statuses];
	}, [events]);

	// Initialize conditional return logic here to prevent hook violation
	if (isLoading) {
		return (
			<div className="flex bg-background-dashboard min-h-screen items-center justify-center">
				<Loader />
			</div>
		);
	}

	// Filter Logic
	const filteredEvents = events.filter((e) => {
		const isDateMatch = e.date === currentDate;
		const isSearchMatch =
			e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(e.reason && e.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
			e.startTime.includes(searchQuery);

		const matchesStatus = filterStatus === "All" || e.type === filterStatus;

		const isTagged = !!e.reason;
		const matchesTagged = filterTagged === "All" || (filterTagged === "Tagged" && isTagged) || (filterTagged === "Untagged" && !isTagged);

		return isDateMatch && isSearchMatch && !e.isOngoing && matchesStatus && matchesTagged;
	});

	const handleReasonSaved = (eventId: string, updates: Record<string, unknown>) => {
		setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, ...updates } : e)));
	};

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
				<main className="!py-2 px-4 space-y-2 pb-24 flex-1 flex flex-col">
					{/* Stats Grid - Hide if future date */}
					{!isFutureDate && (
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
					)}

					{/* Search Bar - Hide if future date */}
					{!isFutureDate && (
						<div className="pb-1">
							<SearchFilterBar
								searchQuery={searchQuery}
								onSearchChange={setSearchQuery}
								placeholder="Search events..."
								showFilters={showFilters}
								onToggleFilters={() => {
									if (showFilters) {
										setFilterStatus("All");
										setFilterTagged("All");
									}
									setShowFilters(!showFilters);
								}}
							/>

							{showFilters && (
								<div className="mt-2 animate-in slide-in-from-top-1 fade-in duration-200 grid grid-cols-2 gap-3">
									<div>
										<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Status</p>
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
										<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Tag Status</p>
										<div className="relative">
											<Select
												value={filterTagged}
												onChange={setFilterTagged}
												options={["All", "Tagged", "Untagged"]}
												placeholder="All"
												className="w-full h-8 bg-white rounded-md text-xs"
											/>
										</div>
									</div>
								</div>
							)}
						</div>
					)}

					<div className="space-y-2 flex-1 flex flex-col">
						{loading ? (
							<div className="flex-1 flex flex-col items-center justify-center py-12">
								<Loader />
							</div>
						) : error ? (
							<div className="text-center py-12 flex flex-col items-center">
								<span className="material-symbols-outlined text-[48px] text-red-300 mb-2">error</span>
								<p className="text-sm font-bold text-red-400">{error}</p>
							</div>
						) : isFutureDate ? (
							<div className="flex-1 flex flex-col items-center justify-center -mt-20">
								<EmptyState icon="event_busy" title="Future Date" description="Cannot view data for future dates." />
							</div>
						) : filteredEvents.length > 0 ? (
							filteredEvents.map((event) => (
								<EventCard
									key={event.id}
									event={event}
									machineId={machineId}
									clusterId={clusterId}
									currentDate={currentDate}
									currentShift={currentShift}
									onReasonSaved={handleReasonSaved}
								/>
							))
						) : (
							<div className="flex-1 flex flex-col items-center justify-center -mt-20">
								<EmptyState
									icon="event_busy"
									title="No Events Found"
									description={
										<span>
											No downtime events recorded for <br />
											<span className="text-primary font-bold mt-1 block">{currentDate}</span>
										</span>
									}
								/>
							</div>
						)}
					</div>
				</main>
			)}
		</div>
	);
}

function EventCard({
	event,
	machineId,
	clusterId,
	currentDate,
	currentShift,
	onReasonSaved,
}: {
	event: DowntimeEvent;
	machineId: string;
	clusterId: string;
	currentDate: string;
	currentShift: string;
	onReasonSaved: (eventId: string, updates: Record<string, unknown>) => void;
}) {
	const [isExpanded, setIsExpanded] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [reason, setReason] = useState(event.reason || "");

	useEffect(() => {
		setReason(event.reason || "");
	}, [event.reason]);

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

	const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		if (isSaving) return;
		setIsSaving(true);
		try {
			if (!clusterId) throw new Error("Cluster ID is not configured.");
			if (!machineId || machineId === "Unknown Machine") throw new Error("Invalid machine ID");
			if (!reason) throw new Error("Please select a reason code.");
			if (!event.rawStartTime || !event.rawEndTime) throw new Error("Missing event time range.");

			const { fromDateUTC, toDateUTC } = buildUtcRangeFromIstDate(currentDate, currentShift);
			const account = {};
			const category = getReasonCategory(reason);
			const metadata = {
				reasonCode: Number(reason),
				reasonDescription: getReasonDescription(reason),
			};

			const existingGroups = await readDeviceStateEventGroupsWithItems({
				deviceId: machineId,
				clusterId,
				account,
				query: {
					rangeStart: fromDateUTC.toISOString(),
					rangeEnd: toDateUTC.toISOString(),
				},
			});

			const rangeStartMs = fromDateUTC.getTime();
			const rangeEndMs = toDateUTC.getTime();
			const matchingGroup = Array.isArray(existingGroups)
				? existingGroups.find((group) => {
						const startMs = group?.rangeStart ? new Date(group.rangeStart).getTime() : NaN;
						const endMs = group?.rangeEnd ? new Date(group.rangeEnd).getTime() : NaN;

						// Check metadata for annotationType: 'event'
						// We treat 'null' metadata as valid for legacy reasons?
						// NO, user said: "if any item didnot match we create group and item if any group and item is there with that we update group"
						// AND "check in that metadat is annoationstype is event"
						// So we MUST strictly match annotationType === 'event'.
						const meta = group?.metadata as Record<string, unknown> | undefined;
						const isEventGroup = meta?.annotationType === "event";

						return startMs === rangeStartMs && endMs === rangeEndMs && isEventGroup;
					})
				: null;

			const itemPayload: DeviceStateEventItemInput = {
				segmentStart: event.rawStartTime,
				segmentEnd: event.rawEndTime,
				state: event.type,
				category,
				scopeType: "DEVICE_STATUS" as const,
				notes: undefined,
				metadata,
			};

			let savedGroupId: string | null = matchingGroup?.id ?? null;
			let savedItemId: string | null = event.itemId ?? null;
			let savedGroup: any = null;

			if (matchingGroup?.id) {
				if (event.itemId) {
					const updated = await updateDeviceStateEventGroupItems({
						deviceId: machineId,
						clusterId,
						groupId: matchingGroup.id,
						account,
						items: [
							{
								id: event.itemId,
								segmentStart: event.rawStartTime,
								segmentEnd: event.rawEndTime,
								category,
								scopeType: "DEVICE_STATUS",
								notes: undefined,
								metadata,
							} as DeviceStateEventItemUpdateInput,
						],
					});
					savedGroup = updated;
				} else {
					const created = await createDeviceStateEventGroupItems({
						deviceId: machineId,
						clusterId,
						groupId: matchingGroup.id,
						account,
						items: [itemPayload],
					});
					savedGroup = created;
				}
			} else {
				const created = await createDeviceStateEventGroup({
					deviceId: machineId,
					clusterId,
					account,
					body: {
						rangeStart: fromDateUTC.toISOString(),
						rangeEnd: toDateUTC.toISOString(),
						title: `Event-${fromDateUTC.toISOString().split("T")[0]}-${toDateUTC.toISOString().split("T")[0]}`,
						metadata: { annotationType: "event" },
						items: [itemPayload],
					},
				});
				savedGroup = created;
				savedGroupId = created?.id ?? null;
			}

			if (savedGroup?.Items && Array.isArray(savedGroup.Items)) {
				const matched = savedGroup.Items.find((item: any) => {
					return (
						normalizeIso(item.segmentStart) === normalizeIso(event.rawStartTime) &&
						normalizeIso(item.segmentEnd) === normalizeIso(event.rawEndTime)
					);
				});
				savedItemId = matched?.id ?? savedItemId;
			}

			onReasonSaved(event.id, {
				reason,
				category,
				itemId: savedItemId,
				groupId: savedGroupId,
			});
			setIsExpanded(true);

			toast.custom((t) => <CustomToast t={t} type="success" title="Save Successful" message="Reason code has been saved successfully." />);
		} catch (err) {
			console.error("Failed to save reason code:", err);
			toast.custom((t) => (
				<CustomToast t={t} type="error" title="Save Failed" message={err instanceof Error ? err.message : "Failed to save reason code."} />
			));
		} finally {
			setIsSaving(false);
		}
	};

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
						{/* {event.category ? <span className="ml-3 text-[10px] font-normal text-gray-500">{event.category}</span> : null} */}
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
				<div
					className={cn(
						"bg-white border-t border-gray-100 px-4 py-2 space-y-2 animate-in slide-in-from-top-2 duration-200 rounded-b-xl",
						isSaving && "opacity-80 pointer-events-none",
					)}
				>
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
								onClick={handleSave}
								disabled={isSaving}
								className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-70 disabled:pointer-events-none min-w-[60px] flex justify-center items-center"
							>
								{isSaving ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "SAVE"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
