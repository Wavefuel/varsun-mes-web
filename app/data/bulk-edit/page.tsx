"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useData } from "@/context/DataContext";
import {
	fetchDeviceList,
	batchReadDeviceStateEvents,
	syncDeviceStateEventGroups,
	type DeviceStateEventItemUpdateInput,
	type DeviceStateEventItemInput,
	type DeviceStatusPeriod,
} from "@/utils/scripts";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { ReasonCodeSelect, getReasonCategory, getReasonDescription } from "@/components/ReasonCodeSelect";
import { formatTimeToIST } from "@/utils/dateUtils";

import { AssignmentLabel, AssignmentField } from "@/components/AssignmentComponents";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchFilterBar from "@/components/SearchFilterBar";
import Select from "@/components/ui/Select";
import { parse, format } from "date-fns";

// Utility for class merging
function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface DowntimeEvent {
	id: string;
	machineId: string;
	machineName: string;
	startTime: string;
	endTime: string;
	rawStartTime: string;
	rawEndTime: string;
	duration: string;
	type: string;
	reason: string;
	notes: string;
	itemId: string | null;
	groupId: string | null;
	metadata: any;
	isOngoing?: boolean;
	date?: string;
	durationMinutes: number;
}

const getEventStatusStyles = (type: string) => {
	switch (type?.toUpperCase()) {
		case "RUNNING":
			return { bg: "bg-green-100", text: "text-green-700", border: "border-green-200", icon: "play_circle" };
		case "IDLE":
			return { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", icon: "schedule" };
		case "OFFLINE":
			return { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", icon: "power_off" };
		case "MAINTENANCE":
			return { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200", icon: "build" };
		case "ERROR":
			return { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", icon: "error" };
		default:
			return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200", icon: "help" };
	}
};

const STATUS_OPTIONS = ["RUNNING", "IDLE", "OFFLINE", "MAINTENANCE", "ERROR"];

// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------

const formatDuration = (minutes: number) => {
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ""}`;
	return `${m}m`;
};

const buildUtcFromLocalinfo = (dateStr: string, timeStr: string) => {
	const offset = "+05:30"; // Assuming IST
	const iso = `${dateStr}T${timeStr}:00${offset}`;
	const d = new Date(iso);
	return d;
};

// Returns "hh:mm aa" format from "HH:mm"
const formatTimeDisplay = (time24: string) => {
	if (!time24) return "";
	try {
		const date = parse(time24, "HH:mm", new Date());
		return format(date, "hh:mm aa");
	} catch (e) {
		return time24;
	}
};

const normalizeIso = (value?: string | Date | null) => {
	if (!value) return "";
	const parsed = value instanceof Date ? value : new Date(value);
	return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
};

// ----------------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------------

export default function BulkEditPage() {
	const router = useRouter();
	const { eventsDevices, setEventsDevices } = useData();

	// -- State: Wizard Step --
	const [step, setStep] = useState<1 | 2 | 3>(1);

	// -- State: Step 1 (Filters) --
	const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
	const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
	const [startTime, setStartTime] = useState("00:00");
	const [endTime, setEndTime] = useState("23:59");
	const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
	const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

	// -- State: Step 2 (Data) --
	const [isFetching, setIsFetching] = useState(false);
	const [fetchedEvents, setFetchedEvents] = useState<DowntimeEvent[]>([]);
	const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
	const [eventSearchQuery, setEventSearchQuery] = useState("");
	const [showEventFilters, setShowEventFilters] = useState(false);

	// Step 2 Filters
	const [filterDeviceId, setFilterDeviceId] = useState("All");
	const [filterMinDuration, setFilterMinDuration] = useState("");
	const [filterMaxDuration, setFilterMaxDuration] = useState("");

	// -- State: Step 3 (Update) --
	const [targetReason, setTargetReason] = useState("");
	const [isUpdating, setIsUpdating] = useState(false);
	const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });

	// -- Load Devices --
	useEffect(() => {
		if (eventsDevices.length > 0) return;
		// If clusterId is empty, server action will use env fallback
		fetchDeviceList({}).then(setEventsDevices).catch(console.error);
	}, [eventsDevices.length, setEventsDevices]);

	// -- Handlers --

	const handleDeviceToggle = (id: string) => {
		setSelectedDeviceIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
	};

	const handleSelectAllDevices = () => {
		if (selectedDeviceIds.length === eventsDevices.length) {
			setSelectedDeviceIds([]);
		} else {
			setSelectedDeviceIds(eventsDevices.map((d) => d.id));
		}
	};

	const handleStatusSelect = (status: string) => {
		setSelectedStatuses((prev) => (prev.includes(status) ? [] : [status]));
	};

	const fetchEvents = async () => {
		// if (!lhtClusterId) {
		// 	toast.error("Cluster ID not configured");
		// 	return;
		// }
		if (selectedDeviceIds.length === 0) {
			toast.error("Please select at least one device");
			return;
		}
		if (selectedStatuses.length === 0) {
			toast.error("Please select at least one status");
			return;
		}

		setIsFetching(true);
		setFetchedEvents([]);
		setSelectedEventIds(new Set());

		try {
			// Ensure times are in HH:mm:ss format
			const formatTime = (time: string) => {
				if (!time) return "00:00:00";
				// If already has seconds, return as is
				if (time.includes(":") && time.split(":").length === 3) return time;
				// Otherwise append :00
				return `${time}:00`;
			};

			// Helper: Find nearest shift end time after the given end time
			// Shift boundaries: 08:00 AM (02:30 UTC) and 08:00 PM (14:30 UTC) IST
			const findNearestShiftEnd = (dateStr: string, timeStr: string): { date: string; time: string } => {
				// Parse the user's end date/time in IST context
				const userEndDateTime = buildUtcFromLocalinfo(dateStr, timeStr);
				const userEndMs = userEndDateTime.getTime();

				// Shift boundaries in UTC: 02:30 and 14:30
				const shiftBoundaries = [
					{ hour: 2, minute: 30 }, // 08:00 AM IST
					{ hour: 14, minute: 30 }, // 08:00 PM IST
				];

				// Start checking from the user's end date
				let checkDate = new Date(userEndDateTime);

				// Look ahead up to 2 days to find the next shift boundary
				for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
					for (const boundary of shiftBoundaries) {
						const candidate = new Date(checkDate);
						candidate.setUTCHours(boundary.hour, boundary.minute, 0, 0);

						if (candidate.getTime() >= userEndMs) {
							// Found the nearest shift end after user's end time
							// Convert UTC to IST (UTC + 5:30)
							const istDate = new Date(candidate.getTime() + 5.5 * 60 * 60 * 1000);
							const istHours = istDate.getUTCHours();
							const istMinutes = istDate.getUTCMinutes();

							const extendedTime = `${String(istHours).padStart(2, "0")}:${String(istMinutes).padStart(2, "0")}:00`;
							const extendedDateStr = istDate.toISOString().split("T")[0];

							return { date: extendedDateStr, time: extendedTime };
						}
					}
					// Move to next day
					checkDate.setUTCDate(checkDate.getUTCDate() + 1);
				}

				// Fallback: return original if no boundary found (shouldn't happen)
				return { date: dateStr, time: formatTime(timeStr) };
			};

			// Get extended end time for server fetch (to nearest shift boundary)
			const extendedEnd = findNearestShiftEnd(endDate, endTime);

			console.log("Fetching events with params:", {
				startDate,
				endDate: extendedEnd.date,
				startTime: formatTime(startTime),
				endTime: extendedEnd.time,
				selectedStatuses,
				note: `Extended from user's ${endDate} ${endTime} to shift boundary ${extendedEnd.date} ${extendedEnd.time}`,
			});

			// Use batch read API - single call for all devices!
			const result = await batchReadDeviceStateEvents({
				body: {
					deviceIds: selectedDeviceIds,
					startDate,
					endDate: extendedEnd.date,
					startTime: formatTime(startTime),
					endTime: extendedEnd.time,
					statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
					minDurationMinutes: 15,
				},
			});

			// Process the batch response
			const allEvents: DowntimeEvent[] = [];

			for (const deviceId of selectedDeviceIds) {
				const deviceData = result.data?.[deviceId];
				if (!deviceData) continue;

				const deviceName = deviceData.deviceName || eventsDevices.find((d) => d.id === deviceId)?.deviceName || deviceId;

				// Flatten group items for matching
				const groupItems: any[] = [];
				for (const group of deviceData.groups) {
					const items = Array.isArray(group?.Items) ? group.Items : [];
					items.forEach((item: any) => {
						groupItems.push({
							...item,
							groupId: group.id,
							annotationType: group?.metadata?.annotationType,
						});
					});
				}

				// Process each period with shift splitting
				for (const period of deviceData.periods) {
					// 1. Determine effective start/end
					const pStart = new Date(period.startTime);
					const now = new Date();
					const pEnd = period.isOngoing ? now : period.endTime ? new Date(period.endTime) : now;

					const startMs = pStart.getTime();
					const endMs = pEnd.getTime();

					// 2. Generate boundaries (08:00 IST = 02:30 UTC, 20:00 IST = 14:30 UTC)
					// We iterate from start day to end day
					const boundaries: number[] = [];
					const current = new Date(pStart);
					current.setUTCHours(0, 0, 0, 0); // Start of UTC day

					// Look a bit back and forward to be safe
					const finalEnd = new Date(pEnd);
					finalEnd.setUTCDate(finalEnd.getUTCDate() + 1);

					while (current <= finalEnd) {
						// 02:30 UTC
						const b1 = new Date(current);
						b1.setUTCHours(2, 30, 0, 0);
						if (b1.getTime() > startMs && b1.getTime() < endMs) boundaries.push(b1.getTime());

						// 14:30 UTC
						const b2 = new Date(current);
						b2.setUTCHours(14, 30, 0, 0);
						if (b2.getTime() > startMs && b2.getTime() < endMs) boundaries.push(b2.getTime());

						// Next day
						current.setUTCDate(current.getUTCDate() + 1);
					}

					boundaries.sort((a, b) => a - b);

					// 3. Create segments
					const segments: { start: number; end: number }[] = [];
					let lastTime = startMs;

					for (const b of boundaries) {
						segments.push({ start: lastTime, end: b });
						lastTime = b;
					}
					// Add final segment
					if (lastTime < endMs) {
						segments.push({ start: lastTime, end: endMs });
					}

					// 4. Process segments
					const queryStartMs = buildUtcFromLocalinfo(startDate, startTime).getTime();
					const queryEndMs = buildUtcFromLocalinfo(endDate, endTime).getTime();

					segments.forEach((seg, idx) => {
						// Filter: Only show segments whose START TIME is within the selected time period
						// This ensures we only display events that started during the selected range
						if (seg.start < queryStartMs) return; // Started before selected period
						if (seg.start >= queryEndMs) return; // Started after selected period

						// Daily Time Filter: Ensure strictly within the daily time slot (IST)
						const [sH, sM] = startTime.split(":").map(Number);
						const [eH, eM] = endTime.split(":").map(Number);
						const userStartMins = sH * 60 + sM;
						const userEndMins = eH * 60 + eM;

						// Convert segment start to IST time-of-day
						// seg.start is UTC timestamp; IST is UTC+5:30
						const istOffsetMs = 5.5 * 60 * 60 * 1000;
						const segIstDate = new Date(seg.start + istOffsetMs);
						const segMins = segIstDate.getUTCHours() * 60 + segIstDate.getUTCMinutes();

						if (userStartMins <= userEndMins) {
							// Standard range (e.g. 12:00 - 14:00)
							if (segMins < userStartMins || segMins >= userEndMins) return;
						} else {
							// Cross-midnight range (e.g. 22:00 - 02:00)
							// Reject if it falls in the gap (e.g. 02:00 to 22:00)
							if (segMins >= userEndMins && segMins < userStartMins) return;
						}

						const segStartIso = new Date(seg.start).toISOString();
						const segEndIso = new Date(seg.end).toISOString();
						const durationMins = (seg.end - seg.start) / (1000 * 60);

						// Apply minimum duration filter (must match server-side minDurationMinutes)
						const MIN_DURATION_MINUTES = 15;
						if (durationMins < MIN_DURATION_MINUTES) return;

						// Match metadata
						// We try to match based on the FULL original period boundaries if possible,
						// OR strictly match if there's an item that matches this specific segment.
						// The original logic matched `period.startTime` to `item.segmentStart`.
						// If we split, we might lose that 1-to-1 match for the split parts unless they were individually tagged.
						// STRATEGY:
						// 1. Try to find item matching THIS segment exactly.
						// 2. If not found, try to find item matching the WHOLE period (inherited).
						// Actually, typically in this DB, items are created for the specific range.
						// If untagged, we rely on period.status.
						// If we split an UNTAGGED period, both parts act as untagged.

						const segStartNorm = normalizeIso(segStartIso);
						const segEndNorm = normalizeIso(segEndIso);

						const matchedItem = groupItems.find((item: any) => {
							const itemStart = normalizeIso(item.segmentStart);
							const itemEnd = normalizeIso(item.segmentEnd);
							const isEventGroup = item.annotationType === "event";
							return itemStart === segStartNorm && itemEnd === segEndNorm && isEventGroup;
						});

						const reasonCode = matchedItem?.metadata?.reasonCode ?? matchedItem?.notes ?? "";

						// Format Date for display
						const displayDate = new Date(seg.start).toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
							year: "numeric",
						});

						allEvents.push({
							id: `${deviceId}-${segStartIso}-${idx}`, // Unique ID for split
							machineId: deviceId,
							machineName: deviceName,
							rawStartTime: segStartIso,
							rawEndTime: segEndIso,
							startTime: formatTimeToIST(segStartIso),
							endTime: period.isOngoing && idx === segments.length - 1 ? "Ongoing" : formatTimeToIST(segEndIso),
							duration: formatDuration(durationMins),
							type: period.status,
							reason: reasonCode ? String(reasonCode) : "",
							notes: matchedItem?.notes || "",
							itemId: matchedItem?.id ?? null,
							groupId: matchedItem?.groupId ?? null,
							metadata: matchedItem?.metadata || {},
							isOngoing: period.isOngoing && idx === segments.length - 1,
							date: displayDate,
							durationMinutes: durationMins,
						});
					});
				}
			}

			// Sort by most recent first
			const sorted = allEvents.sort((a, b) => new Date(b.rawStartTime).getTime() - new Date(a.rawStartTime).getTime());
			setFetchedEvents(sorted);
			setStep(2);
		} catch (error) {
			console.error(error);
			toast.error("Failed to fetch events");
		} finally {
			setIsFetching(false);
		}
	};

	const handleEventToggle = (uniqueId: string) => {
		const newSet = new Set(selectedEventIds);
		if (newSet.has(uniqueId)) newSet.delete(uniqueId);
		else newSet.add(uniqueId);
		setSelectedEventIds(newSet);
	};

	const handleSelectAllEvents = () => {
		if (selectedEventIds.size === fetchedEvents.length) {
			setSelectedEventIds(new Set());
		} else {
			setSelectedEventIds(new Set(fetchedEvents.map((e) => e.id)));
		}
	};

	const handleBatchUpdate = async () => {
		if (selectedEventIds.size === 0) return;
		if (!targetReason) {
			toast.error("Please select a reason code");
			return;
		}

		setIsUpdating(true);
		setUpdateProgress({ current: 0, total: selectedEventIds.size });

		const eventsToUpdate = fetchedEvents.filter((e) => selectedEventIds.has(e.id));
		const account = {};
		const category = getReasonCategory(targetReason);
		const reasonDescription = getReasonDescription(targetReason);

		try {
			// Prepare sync body for all operations
			const syncBody: {
				create?: any[];
				update?: any[];
			} = {};

			// Group updates by groupId
			const updatesByGroup = new Map<string, { deviceId: string; items: any[] }>();
			const createsForNewGroups: any[] = [];

			for (const ev of eventsToUpdate) {
				const itemMetadata = {
					...ev.metadata,
					reasonCode: Number(targetReason),
					reasonDescription,
				};

				if (ev.groupId && ev.itemId) {
					// UPDATE Existing - group by groupId
					if (!updatesByGroup.has(ev.groupId)) {
						updatesByGroup.set(ev.groupId, {
							deviceId: ev.machineId,
							items: [],
						});
					}

					updatesByGroup.get(ev.groupId)!.items.push({
						id: ev.itemId,
						segmentStart: ev.rawStartTime,
						segmentEnd: ev.rawEndTime,
						category,
						scopeType: "DEVICE_STATUS",
						metadata: itemMetadata,
					});
				} else {
					// CREATE New (Raw period being tagged for first time)
					createsForNewGroups.push({
						deviceId: ev.machineId,
						rangeStart: ev.rawStartTime,
						rangeEnd: ev.rawEndTime,
						title: `EVENT-${ev.rawStartTime.split("T")[0]}`,
						metadata: { annotationType: "event" },
						items: [
							{
								segmentStart: ev.rawStartTime,
								segmentEnd: ev.rawEndTime,
								state: ev.type,
								category,
								scopeType: "DEVICE_STATUS",
								metadata: {
									reasonCode: Number(targetReason),
									reasonDescription,
									annotationType: "event",
								},
							},
						],
					});
				}

				// Update progress
				setUpdateProgress((prev) => ({ ...prev, current: prev.current + 1 }));
			}

			// Build sync body
			if (createsForNewGroups.length > 0) {
				syncBody.create = createsForNewGroups;
			}

			if (updatesByGroup.size > 0) {
				syncBody.update = Array.from(updatesByGroup.entries()).map(([groupId, data]) => ({
					groupId,
					deviceId: data.deviceId,
					items: {
						update: data.items,
					},
				}));
			}

			// Execute single sync call for all operations
			if (Object.keys(syncBody).length > 0) {
				await syncDeviceStateEventGroups({
					// account, // Rely on server fallback
					body: syncBody,
				});
			}

			setIsUpdating(false);
			toast.success(`Successfully updated ${eventsToUpdate.length} events`);
			router.push("/data");
		} catch (err) {
			console.error("Batch update failed:", err);
			setIsUpdating(false);
			toast.error("Batch update failed: " + (err as any).message);
		}
	};

	// Match styling of the buttons in app/planning/create/page.tsx
	const saveBtnClass =
		"bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform disabled:opacity-70 disabled:pointer-events-none min-w-[60px] flex justify-center items-center";
	const cancelBtnClass =
		"text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none";

	// Custom Date Input Render exactly like AssignmentDetailsCard
	const renderDateInput = (value: string, onClick?: () => void) => (
		<button onClick={onClick} className="w-full relative bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 text-left transition-all">
			<span className="!text-xs font-medium block pr-8 text-gray-700">
				{value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Select Date"}
			</span>
			<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 !text-gray-400 !text-xl pointer-events-none">
				calendar_today
			</span>
		</button>
	);

	// Custom Time Input Render exactly like AssignmentDetailsCard (mimicked style)
	const renderTimeInput = (value: string, onClick?: () => void) => (
		<button onClick={onClick} className="w-full relative bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 text-left transition-all">
			<span className="!text-xs font-medium block pr-8 text-gray-700">{formatTimeDisplay(value) || "Select Time"}</span>
			<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 !text-gray-400 !text-xl pointer-events-none">
				schedule
			</span>
		</button>
	);

	// -- Logic for Step 2 Filtering --
	const filteredFetchedEvents = fetchedEvents.filter((ev) => {
		const matchesSearch =
			!eventSearchQuery.trim() ||
			ev.machineName.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
			ev.reason.toLowerCase().includes(eventSearchQuery.toLowerCase());

		const matchesDevice = filterDeviceId === "All" || ev.machineId === filterDeviceId;

		const minDur = filterMinDuration ? Number(filterMinDuration) : 0;
		const maxDur = filterMaxDuration ? Number(filterMaxDuration) : Infinity;
		const matchesDuration = ev.durationMinutes >= minDur && ev.durationMinutes <= maxDur;

		return matchesSearch && matchesDevice && matchesDuration;
	});

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard font-display">
			{/* Custom Header Structure - Matching app/planning/create/page.tsx exactly */}
			<header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-(--header-height) px-4 py-2">
				<div className="flex items-center justify-between h-full">
					<div className="flex flex-col">
						<h2 className="header-title">Bulk Update</h2>
						<p className="header-subtitle mt-0.5 uppercase block">
							{step === 1 ? "FILTER CRITERIA" : step === 2 ? "SELECT EVENTS" : "APPLY UPDATE"}
						</p>
					</div>
					<div className="flex items-center gap-3">
						<button onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : router.back())} className={cancelBtnClass}>
							BACK
						</button>

						{step === 1 && (
							<button onClick={fetchEvents} disabled={isFetching} className={saveBtnClass}>
								{isFetching ? <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "SEARCH"}
							</button>
						)}
						{step === 2 && (
							<button onClick={() => setStep(3)} disabled={selectedEventIds.size === 0} className={saveBtnClass}>
								NEXT ({selectedEventIds.size})
							</button>
						)}
						{step === 3 && (
							<button onClick={handleBatchUpdate} disabled={isUpdating} className={saveBtnClass}>
								{isUpdating ? <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "UPDATE"}
							</button>
						)}
					</div>
				</div>
			</header>

			<div className="flex-1 p-4 flex flex-col items-center">
				<div className="w-full max-w-2xl space-y-4">
					{/* Step 1: Filter Card */}
					{step === 1 && (
						<section className="bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden">
							<div className="bg-gray-50 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center rounded-t-xl">
								<h3 className="font-bold text-sm uppercase tracking-wider text-primary">Select Filters</h3>
								<span className="material-symbols-outlined text-gray-400 !text-2xl">filter_alt</span>
							</div>
							<div className="p-3 space-y-2">
								<div className="space-y-3">
									{/* Date Range */}
									<div className="grid grid-cols-2 !gap-3">
										<AssignmentField label="Start Date">
											<div className="relative w-full">
												<CustomDatePicker
													value={startDate}
													onChange={setStartDate}
													customInput={renderDateInput(startDate)}
												/>
											</div>
										</AssignmentField>
										<AssignmentField label="End Date">
											<div className="relative w-full">
												<CustomDatePicker value={endDate} onChange={setEndDate} customInput={renderDateInput(endDate)} />
											</div>
										</AssignmentField>
									</div>

									{/* Time Range */}
									<div className="grid grid-cols-2 !gap-3">
										<AssignmentField label="Start Time">
											<div className="relative w-full">
												<CustomDatePicker
													value={startTime}
													onChange={setStartTime}
													showTimeSelectOnly
													dateFormat="hh:mm aa"
													customInput={renderTimeInput(startTime)}
												/>
											</div>
										</AssignmentField>
										<AssignmentField label="End Time">
											<div className="relative w-full">
												<CustomDatePicker
													value={endTime}
													onChange={setEndTime}
													showTimeSelectOnly
													dateFormat="hh:mm aa"
													customInput={renderTimeInput(endTime)}
												/>
											</div>
										</AssignmentField>
									</div>

									{/* Status Filter */}
									<div>
										<AssignmentField
											label={
												<span>
													Status <span className="text-red-500">*</span>
												</span>
											}
										>
											<div className="flex flex-wrap gap-2">
												{STATUS_OPTIONS.map((st) => (
													<button
														key={st}
														onClick={() => handleStatusSelect(st)}
														className={cn(
															"px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all uppercase tracking-wider",
															selectedStatuses.includes(st)
																? "bg-primary text-white border-primary"
																: "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100",
														)}
													>
														{st}
													</button>
												))}
											</div>
										</AssignmentField>
									</div>

									{/* Device Selection */}
									<div>
										<div className="flex justify-between items-end mb-1">
											<AssignmentLabel>Devices</AssignmentLabel>
											<button
												onClick={handleSelectAllDevices}
												className="text-[10px] font-bold text-primary uppercase hover:underline"
											>
												{selectedDeviceIds.length === eventsDevices.length ? "Deselect All" : "Select All"}
											</button>
										</div>
										<div className="border border-gray-200 bg-gray-50 !rounded-lg max-h-48 overflow-y-auto p-2 space-y-1 custom-scrollbar">
											{eventsDevices.map((d) => (
												<label
													key={d.id}
													className={cn(
														"flex items-center gap-3 p-2 rounded border border-transparent cursor-pointer transition-all hover:bg-gray-200/50",
													)}
												>
													<input
														type="checkbox"
														checked={selectedDeviceIds.includes(d.id)}
														onChange={() => handleDeviceToggle(d.id)}
														className="rounded border-gray-300 text-primary focus:ring-primary/20 size-4"
													/>
													<span className="text-xs font-bold text-gray-700">{d.deviceName || d.id}</span>
												</label>
											))}
										</div>
									</div>
								</div>
							</div>
						</section>
					)}

					{/* Step 3: Update UI (No Card Wrapper, Visible Overflow) */}
					{step === 3 && (
						<div className="w-full max-w-lg mx-auto pt-8">
							<div className="bg-white rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50 p-6 relative overflow-visible">
								<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40 rounded-t-2xl" />

								<div className="flex flex-col items-center text-center mb-8 mt-2">
									<div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 rotate-3">
										<span className="material-symbols-outlined text-3xl">edit_note</span>
									</div>
									<h3 className="text-xl font-bold text-gray-900">Apply Reason Code</h3>
									<p className="text-sm text-gray-500 mt-2 max-w-[90%] leading-relaxed">
										You are about to update the reason code for{" "}
										<span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">
											{selectedEventIds.size} selected events
										</span>
										.
									</p>
								</div>

								<div className="space-y-6">
									<div className="space-y-2 text-left">
										<label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">New Reason Code</label>
										<ReasonCodeSelect
											value={targetReason}
											onChange={setTargetReason}
											eventType={fetchedEvents.find((ev) => selectedEventIds.has(ev.id))?.type || "IDLE"}
											className="w-full"
										/>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Step 2: List */}
					{step === 2 && (
						<div className="w-full flex flex-col gap-4">
							{/* Search & Filter Bar */}
							<div className="sticky top-[58px] z-40 bg-background-dashboard pt-2 pb-2 space-y-3">
								<SearchFilterBar
									searchQuery={eventSearchQuery}
									onSearchChange={setEventSearchQuery}
									placeholder="Search events..."
									showFilters={showEventFilters}
									onToggleFilters={() => setShowEventFilters(!showEventFilters)}
								/>

								{/* Expanded Filter Panel */}
								{showEventFilters && (
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in slide-in-from-top-1 fade-in duration-200">
										{/* Device Filter */}
										<div className="space-y-1">
											<label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Device</label>
											<Select
												value={filterDeviceId}
												onChange={setFilterDeviceId}
												options={["All", ...eventsDevices.map((d) => ({ label: d.deviceName || d.id, value: d.id }))]}
												className="w-full h-9 text-xs bg-white border-gray-200 shadow-sm"
											/>
										</div>

										{/* Min Duration */}
										<div className="space-y-1">
											<label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Min Duration (m)</label>
											<input
												type="number"
												value={filterMinDuration}
												onChange={(e) => setFilterMinDuration(e.target.value)}
												placeholder="0"
												className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none shadow-sm"
											/>
										</div>

										{/* Max Duration */}
										<div className="space-y-1">
											<label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Max Duration (m)</label>
											<input
												type="number"
												value={filterMaxDuration}
												onChange={(e) => setFilterMaxDuration(e.target.value)}
												placeholder="Any"
												className="w-full h-9 px-3 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none shadow-sm"
											/>
										</div>
									</div>
								)}
							</div>

							{/* Selection Info */}
							<div className="flex justify-between items-center px-1">
								<span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
									Showing {filteredFetchedEvents.length} events
								</span>
								<button onClick={handleSelectAllEvents} className="text-[10px] font-bold text-primary uppercase hover:underline">
									{selectedEventIds.size === fetchedEvents.length ? "Deselect All" : "Select All"}
								</button>
							</div>

							{/* List */}
							<div className="space-y-2 pb-20">
								{filteredFetchedEvents.length === 0 ? (
									<EmptyState icon="search_off" title="No Events Found" description="Try adjusting your search or filters." />
								) : (
									filteredFetchedEvents.map((ev) => {
										const styles = getEventStatusStyles(ev.type);
										const isSelected = selectedEventIds.has(ev.id);
										return (
											<div
												key={ev.id}
												onClick={() => handleEventToggle(ev.id)}
												className={cn(
													"relative flex items-stretch gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer group bg-white",
													isSelected
														? "border-primary/40 bg-primary/[0.02]" // Lighter border, very subtle bg
														: "border-gray-100 hover:border-gray-300 hover:shadow-sm",
												)}
											>
												{/* Content Column */}
												<div className="flex-1 flex flex-col gap-1 min-w-0">
													<div className="flex items-center gap-2">
														<h4 className={cn("text-xs font-bold text-gray-800 truncate", isSelected && "text-primary")}>
															{ev.machineName}
														</h4>
														<span
															className={cn(
																"px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border",
																styles.bg,
																styles.text,
																styles.border,
															)}
														>
															{ev.type}
														</span>
													</div>

													<div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
														<span className="text-gray-900">{ev.date}</span>
														<span className="text-gray-300">•</span>
														<span>
															{ev.startTime} - {ev.endTime}
														</span>
														<span className="text-gray-300">•</span>
														<span className="text-gray-700 font-bold">{ev.duration}</span>
													</div>

													{ev.reason && (
														<div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
															<span className="material-symbols-outlined text-[12px] text-primary">edit_note</span>
															<span>
																Current Reason: <span className="font-bold text-gray-700">{ev.reason}</span>
															</span>
														</div>
													)}
												</div>

												{/* Controls Column (Checkbox) */}
												<div className="flex flex-col items-center justify-center pl-2 border-l border-gray-50">
													<div
														className={cn(
															"size-5 rounded-full border-[1.5px] flex items-center justify-center transition-all",
															isSelected
																? "border-primary bg-primary text-white scale-110"
																: "border-gray-300 bg-white text-transparent group-hover:border-gray-400",
														)}
													>
														<span className="material-symbols-outlined !text-[14px] font-bold">check</span>
													</div>
												</div>
											</div>
										);
									})
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
