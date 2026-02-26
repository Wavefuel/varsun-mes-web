"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useData } from "@/context/DataContext";
import { fetchDeviceList, batchReadDeviceStateEvents } from "@/utils/scripts";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { formatTimeToIST } from "@/utils/dateUtils";
import { AssignmentLabel, AssignmentField } from "@/components/AssignmentComponents";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchFilterBar from "@/components/SearchFilterBar";
import Select from "@/components/ui/Select";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

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
	metadata: unknown;
	isOngoing?: boolean;
	date?: string;
	durationMinutes: number;
}

interface GroupItemMatch {
	id?: string;
	segmentStart?: string | Date;
	segmentEnd?: string | Date;
	notes?: string;
	metadata?: Record<string, unknown>;
	annotationType?: string;
}

const getEventStatusStyles = (type: string) => {
	switch (type?.toUpperCase()) {
		case "RUNNING":
			return { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" };
		case "IDLE":
			return { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" };
		case "OFFLINE":
			return { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" };
		case "MAINTENANCE":
			return { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" };
		case "ERROR":
			return { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" };
		default:
			return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" };
	}
};

const STATUS_OPTIONS = ["RUNNING", "IDLE", "OFFLINE", "MAINTENANCE", "ERROR"];

const formatDuration = (minutes: number) => {
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ""}`;
	return `${m}m`;
};

const buildUtcFromLocalinfo = (dateStr: string, timeStr: string) => {
	const offset = "+05:30";
	const iso = `${dateStr}T${timeStr}:00${offset}`;
	return new Date(iso);
};

const toLocalDateTimeInput = (date: Date) => {
	const pad = (n: number) => String(n).padStart(2, "0");
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	const hh = pad(date.getHours());
	const mi = pad(date.getMinutes());
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const getDateAndTimeParts = (value: string) => {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return { dateStr: "", timeStr: "" };
	const pad = (n: number) => String(n).padStart(2, "0");
	const dateStr = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
	const timeStr = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
	return { dateStr, timeStr };
};

const normalizeIso = (value?: string | Date | null) => {
	if (!value) return "";
	const parsed = value instanceof Date ? value : new Date(value);
	return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
};

const formatDateTimeToISTForExport = (iso: string) => {
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) return iso;
	return parsed.toLocaleString("en-US", {
		timeZone: "Asia/Kolkata",
		month: "numeric",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
	});
};

const escapeHtml = (value: unknown) =>
	String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#039;");

const downloadEventsAsExcel = (events: DowntimeEvent[]) => {
	if (!events.length) {
		toast.error("No events to export");
		return;
	}

	const headers = [
		"Machine Name",
		"Machine ID",
		"Status",
		"Start Time (IST)",
		"End Time (IST)",
		"Duration",
		"Reason Code",
	];

	const rows = events
		.map((event) => {
			const values = [
				event.machineName,
				event.machineId,
				event.type,
				formatDateTimeToISTForExport(event.rawStartTime),
				formatDateTimeToISTForExport(event.rawEndTime),
				event.duration,
				event.reason,
			];

			return `<tr>${values.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`;
		})
		.join("");

	const tableHtml = `\ufeff
		<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
			<head>
				<meta charset="UTF-8" />
				<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Events</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
			</head>
			<body>
				<table border="1">
					<thead>
						<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
			</body>
		</html>
	`;

	const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	link.href = url;
	link.download = `events-export-${stamp}.xls`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
};

export default function BulkDownloadPage() {
	const router = useRouter();
	const { eventsDevices, setEventsDevices } = useData();

	const [step, setStep] = useState<1 | 2>(1);

	const [startDateTime, setStartDateTime] = useState(() => toLocalDateTimeInput(new Date()));
	const [endDateTime, setEndDateTime] = useState(() => {
		const d = new Date();
		d.setHours(23, 59, 0, 0);
		return toLocalDateTimeInput(d);
	});
	const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
	const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

	const [isFetching, setIsFetching] = useState(false);
	const [fetchedEvents, setFetchedEvents] = useState<DowntimeEvent[]>([]);
	const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
	const [eventSearchQuery, setEventSearchQuery] = useState("");
	const [showEventFilters, setShowEventFilters] = useState(false);
	const [filterDeviceId, setFilterDeviceId] = useState("All");
	const [filterMinDuration, setFilterMinDuration] = useState("");
	const [filterMaxDuration, setFilterMaxDuration] = useState("");

	useEffect(() => {
		if (eventsDevices.length > 0) return;
		fetchDeviceList({}).then(setEventsDevices).catch(console.error);
	}, [eventsDevices.length, setEventsDevices]);

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
		setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
	};

	const fetchEvents = async () => {
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
			const { dateStr: startDate, timeStr: startTime } = getDateAndTimeParts(startDateTime);
			const { dateStr: endDate, timeStr: endTime } = getDateAndTimeParts(endDateTime);
			if (!startDate || !startTime || !endDate || !endTime) {
				toast.error("Please select valid start and end date-time");
				return;
			}

			const formatTime = (time: string) => {
				if (!time) return "00:00:00";
				if (time.includes(":") && time.split(":").length === 3) return time;
				return `${time}:00`;
			};

			const findNearestShiftEnd = (dateStr: string, timeStr: string): { date: string; time: string } => {
				const userEndDateTime = buildUtcFromLocalinfo(dateStr, timeStr);
				const userEndMs = userEndDateTime.getTime();

				const shiftBoundaries = [
					{ hour: 2, minute: 30 },
					{ hour: 14, minute: 30 },
				];

				const checkDate = new Date(userEndDateTime);

				for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
					for (const boundary of shiftBoundaries) {
						const candidate = new Date(checkDate);
						candidate.setUTCHours(boundary.hour, boundary.minute, 0, 0);

						if (candidate.getTime() >= userEndMs) {
							const istDate = new Date(candidate.getTime() + 5.5 * 60 * 60 * 1000);
							const istHours = istDate.getUTCHours();
							const istMinutes = istDate.getUTCMinutes();

							const extendedTime = `${String(istHours).padStart(2, "0")}:${String(istMinutes).padStart(2, "0")}:00`;
							const extendedDateStr = istDate.toISOString().split("T")[0];
							return { date: extendedDateStr, time: extendedTime };
						}
					}
					checkDate.setUTCDate(checkDate.getUTCDate() + 1);
				}

				return { date: dateStr, time: formatTime(timeStr) };
			};

			const extendedEnd = findNearestShiftEnd(endDate, endTime);

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

			const allEvents: DowntimeEvent[] = [];

			for (const deviceId of selectedDeviceIds) {
				const deviceData = result.data?.[deviceId];
				if (!deviceData) continue;

				const deviceName = deviceData.deviceName || eventsDevices.find((d) => d.id === deviceId)?.deviceName || deviceId;

				const groupItems: GroupItemMatch[] = [];
				for (const group of deviceData.groups) {
					const items = Array.isArray(group?.Items) ? group.Items : [];
					items.forEach((item: unknown) => {
						const parsedItem = item as GroupItemMatch;
						groupItems.push({
							...parsedItem,
							annotationType: group?.metadata?.annotationType,
						});
					});
				}

				for (const period of deviceData.periods) {
					const pStart = new Date(period.startTime);
					const now = new Date();
					const pEnd = period.isOngoing ? now : period.endTime ? new Date(period.endTime) : now;

					const startMs = pStart.getTime();
					const endMs = pEnd.getTime();

					const boundaries: number[] = [];
					const current = new Date(pStart);
					current.setUTCHours(0, 0, 0, 0);
					const finalEnd = new Date(pEnd);
					finalEnd.setUTCDate(finalEnd.getUTCDate() + 1);

					while (current <= finalEnd) {
						const b1 = new Date(current);
						b1.setUTCHours(2, 30, 0, 0);
						if (b1.getTime() > startMs && b1.getTime() < endMs) boundaries.push(b1.getTime());

						const b2 = new Date(current);
						b2.setUTCHours(14, 30, 0, 0);
						if (b2.getTime() > startMs && b2.getTime() < endMs) boundaries.push(b2.getTime());

						current.setUTCDate(current.getUTCDate() + 1);
					}

					boundaries.sort((a, b) => a - b);

					const segments: { start: number; end: number }[] = [];
					let lastTime = startMs;
					for (const b of boundaries) {
						segments.push({ start: lastTime, end: b });
						lastTime = b;
					}
					if (lastTime < endMs) segments.push({ start: lastTime, end: endMs });

					const queryStartMs = buildUtcFromLocalinfo(startDate, startTime).getTime();
					const queryEndMs = buildUtcFromLocalinfo(endDate, endTime).getTime();

						segments.forEach((seg, idx) => {
							if (seg.start < queryStartMs) return;
							if (seg.start > queryEndMs) return;
							if (period.isOngoing && idx === segments.length - 1) return;

						const segStartIso = new Date(seg.start).toISOString();
						const segEndIso = new Date(seg.end).toISOString();
						const durationMins = (seg.end - seg.start) / (1000 * 60);
						if (durationMins < 15) return;

						const segStartNorm = normalizeIso(segStartIso);
						const segEndNorm = normalizeIso(segEndIso);

						const matchedItem = groupItems.find((item) => {
							const itemStart = normalizeIso(item.segmentStart);
							const itemEnd = normalizeIso(item.segmentEnd);
							const isEventGroup = item.annotationType === "event";
							return itemStart === segStartNorm && itemEnd === segEndNorm && isEventGroup;
						});

						const reasonCode = matchedItem?.metadata?.reasonCode ?? matchedItem?.notes ?? "";

						const displayDate = new Date(seg.start).toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
							year: "numeric",
						});

						allEvents.push({
							id: `${deviceId}-${segStartIso}-${idx}`,
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
							metadata: matchedItem?.metadata || {},
							isOngoing: period.isOngoing && idx === segments.length - 1,
							date: displayDate,
							durationMinutes: durationMins,
						});
					});
				}
			}

			const sorted = allEvents.sort((a, b) => new Date(b.rawStartTime).getTime() - new Date(a.rawStartTime).getTime());
			setFetchedEvents(sorted);
			setSelectedEventIds(new Set(sorted.map((event) => event.id)));
			setStep(2);
		} catch (error) {
			console.error(error);
			toast.error("Failed to fetch events");
		} finally {
			setIsFetching(false);
		}
	};

	const handleEventToggle = (eventId: string) => {
		setSelectedEventIds((prev) => {
			const next = new Set(prev);
			if (next.has(eventId)) next.delete(eventId);
			else next.add(eventId);
			return next;
		});
	};

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

	const selectedEvents = fetchedEvents.filter((event) => selectedEventIds.has(event.id));

	const handleSelectAllFiltered = () => {
		setSelectedEventIds((prev) => {
			const next = new Set(prev);
			const allFilteredSelected = filteredFetchedEvents.length > 0 && filteredFetchedEvents.every((event) => next.has(event.id));

			if (allFilteredSelected) {
				filteredFetchedEvents.forEach((event) => next.delete(event.id));
			} else {
				filteredFetchedEvents.forEach((event) => next.add(event.id));
			}

			return next;
		});
	};

	const saveBtnClass =
		"bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform disabled:opacity-70 disabled:pointer-events-none min-w-[60px] flex justify-center items-center";
	const cancelBtnClass =
		"text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none";
	const renderDateTimeInput = (value: string, onClick?: () => void) => (
		<button onClick={onClick} className="w-full relative bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 text-left transition-all">
			<span className="!text-xs font-medium block pr-8 text-gray-700">
				{value ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Select Date & Time"}
			</span>
			<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 !text-gray-400 !text-xl pointer-events-none">schedule</span>
		</button>
	);

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard font-display">
			<header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-(--header-height) px-4 py-2">
				<div className="flex items-center justify-between h-full">
					<div className="flex flex-col">
						<h2 className="header-title">Bulk Download</h2>
						<p className="header-subtitle mt-0.5 uppercase block">{step === 1 ? "FILTER CRITERIA" : "REVIEW & EXPORT"}</p>
					</div>
					<div className="flex items-center gap-3">
						<button onClick={() => (step > 1 ? setStep(1) : router.back())} className={cancelBtnClass}>
							BACK
						</button>

						{step === 1 ? (
							<button onClick={fetchEvents} disabled={isFetching} className={saveBtnClass}>
								{isFetching ? <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "SEARCH"}
							</button>
							) : (
								<button
									onClick={() => downloadEventsAsExcel(selectedEvents)}
									disabled={selectedEvents.length === 0}
									className={saveBtnClass}
								>
									DOWNLOAD EXCEL
							</button>
						)}
					</div>
				</div>
			</header>

			<div className="flex-1 p-4 flex flex-col items-center">
				<div className="w-full max-w-2xl space-y-4" data-picker-boundary>
					{step === 1 && (
						<section className="bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden">
							<div className="bg-gray-50 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center rounded-t-xl">
								<h3 className="font-bold text-sm uppercase tracking-wider text-primary">Select Filters</h3>
								<span className="material-symbols-outlined text-gray-400 !text-2xl">filter_alt</span>
							</div>
							<div className="p-3 space-y-2">
								<div className="space-y-3">
									<div className="grid grid-cols-2 !gap-3">
										<AssignmentField label="Start Date & Time">
											<div className="relative w-full">
												<CustomDatePicker
													value={startDateTime}
													onChange={setStartDateTime}
													mode="datetime"
													customInput={renderDateTimeInput(startDateTime)}
												/>
											</div>
										</AssignmentField>
										<AssignmentField label="End Date & Time">
											<div className="relative w-full">
												<CustomDatePicker
													value={endDateTime}
													onChange={setEndDateTime}
													mode="datetime"
													customInput={renderDateTimeInput(endDateTime)}
												/>
											</div>
										</AssignmentField>
									</div>

										<div>
											<AssignmentField
												label={
													<div className="flex items-center justify-between w-full">
														<span>
															Status <span className="text-red-500">*</span>
														</span>
													</div>
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

									<div>
										<div className="flex justify-between items-end mb-1">
											<AssignmentLabel>Devices</AssignmentLabel>
											<button onClick={handleSelectAllDevices} className="text-[10px] font-bold text-primary uppercase hover:underline">
												{selectedDeviceIds.length === eventsDevices.length ? "Deselect All" : "Select All"}
											</button>
										</div>
										<div className="border border-gray-200 bg-gray-50 !rounded-lg max-h-48 overflow-y-auto p-2 space-y-1 custom-scrollbar">
											{eventsDevices.map((d) => (
												<label key={d.id} className="flex items-center gap-3 p-2 rounded border border-transparent cursor-pointer transition-all hover:bg-gray-200/50">
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

					{step === 2 && (
						<div className="w-full flex flex-col gap-4">
							<div className="sticky top-[58px] z-40 bg-background-dashboard pt-2 pb-2 space-y-3">
								<SearchFilterBar
									searchQuery={eventSearchQuery}
									onSearchChange={setEventSearchQuery}
									placeholder="Search events..."
									showFilters={showEventFilters}
									onToggleFilters={() => setShowEventFilters(!showEventFilters)}
								/>

								{showEventFilters && (
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in slide-in-from-top-1 fade-in duration-200">
										<div className="space-y-1">
											<label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Device</label>
											<Select
												value={filterDeviceId}
												onChange={setFilterDeviceId}
												options={["All", ...eventsDevices.map((d) => ({ label: d.deviceName || d.id, value: d.id }))]}
												className="w-full h-9 text-xs bg-white border-gray-200 shadow-sm"
											/>
										</div>

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

								<div className="flex justify-between items-center px-1">
									<span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
										Showing {filteredFetchedEvents.length} events • Selected {selectedEventIds.size}
									</span>
									<button onClick={handleSelectAllFiltered} className="text-[10px] font-bold text-primary uppercase hover:underline">
										{filteredFetchedEvents.length > 0 && filteredFetchedEvents.every((event) => selectedEventIds.has(event.id))
											? "Deselect Filtered"
											: "Select Filtered"}
									</button>
								</div>

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
														isSelected ? "border-primary/40 bg-primary/[0.02]" : "border-gray-100 hover:border-gray-300 hover:shadow-sm",
													)}
												>
													<div className="flex-1 flex flex-col gap-1 min-w-0">
														<div className="flex items-center gap-2">
															<h4 className="text-xs font-bold text-gray-800 truncate">{ev.machineName}</h4>
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
																Reason: <span className="font-bold text-gray-700">{ev.reason}</span>
															</span>
															</div>
														)}
													</div>
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
