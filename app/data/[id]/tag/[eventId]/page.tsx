"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";
import { CustomToast } from "@/components/CustomToast";
import { ReasonCodeSelect, getReasonCategory, getReasonDescription, getReasonLabel } from "@/components/ReasonCodeSelect";
import { useData } from "@/context/DataContext";
import {
	createDeviceStateEventGroup,
	createDeviceStateEventGroupItems,
	fetchDeviceList,
	fetchDeviceStatusPeriods,
	readDeviceStateEventGroupsWithItems,
	updateDeviceStateEventGroup,
	updateDeviceStateEventGroupItems,
	DeviceStatusPeriod,
} from "@/utils/scripts";
import AppHeader from "@/components/AppHeader";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

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

	return { fromDateUTC, toDateUTC };
};

const normalizeIso = (value?: string | Date | null) => {
	if (!value) return "";
	const parsed = value instanceof Date ? value : new Date(value);
	return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
};

const metadataToArray = (value: unknown) => {
	if (!value || typeof value !== "object") return [] as Array<{ key: string; value: string }>;
	return Object.entries(value as Record<string, unknown>)
		.filter(([key]) => !["reasonCode", "reasonDescription", "category", "tags", "Tags"].includes(key))
		.map(([key, val]) => ({ key, value: String(val) }));
};

const metadataFromArray = (items: Array<{ key: string; value: string }>) => {
	const entries = items.map((item) => ({ key: item.key?.trim(), value: item.value?.trim() })).filter((item) => item.key);
	return entries.length ? Object.fromEntries(entries.map((item) => [item.key as string, item.value ?? ""])) : undefined;
};

export default function EventGroupingPage() {
	const router = useRouter();
	const params = useParams();
	// Safety check for params
	const machineId = params?.id && typeof params.id === "string" ? decodeURIComponent(params.id) : "Unknown Machine";
	const eventId = params?.eventId && typeof params.eventId === "string" ? decodeURIComponent(params.eventId) : "unknown";

	const { currentDate, eventsDevices, setEventsDevices, currentShift } = useData();

	// Fetch devices if not present
	useEffect(() => {
		if (eventsDevices.length > 0) return;

		fetchDeviceList({}).then(setEventsDevices).catch(console.error);
	}, [eventsDevices.length, setEventsDevices]);

	const machineName = React.useMemo(() => {
		const device = eventsDevices.find((d) => d.id === machineId);
		return device?.deviceName || machineId;
	}, [eventsDevices, machineId]);

	const [loading, setLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isError, setIsError] = useState(false);

	// Form State
	const [reason, setReason] = useState("");
	const [metadata, setMetadata] = useState<{ key: string; value: string }[]>([]);
	const [notes, setNotes] = useState("");
	const [tagsText, setTagsText] = useState("");
	const [eventData, setEventData] = useState<any>(null);

	// Initialize Data
	useEffect(() => {
		const loadEvent = async () => {
			try {
				setLoading(true);
				// if (!lhtClusterId) throw new Error("Cluster ID is not configured.");
				if (!machineId || machineId === "Unknown Machine") throw new Error("Invalid machine ID");
				const { fromDateUTC, toDateUTC } = buildUtcRangeFromIstDate(currentDate, currentShift);
				const periods = await fetchDeviceStatusPeriods({
					deviceId: machineId,
					query: {
						fromDate: fromDateUTC.toISOString(),
						toDate: toDateUTC.toISOString(),
						minDurationMinutes: 15,
					},
				});

				const groups = await readDeviceStateEventGroupsWithItems({
					deviceId: machineId,
					query: {
						rangeStart: fromDateUTC.toISOString(),
						rangeEnd: toDateUTC.toISOString(),
					},
				});

				const groupItems = Array.isArray(groups)
					? groups.flatMap((group) => {
							const items = Array.isArray(group?.Items) ? group.Items : [];
							return items.map((item: any) => ({
								...item,
								groupId: group.id,
								groupTags: Array.isArray(group.tags) ? group.tags : [],
								groupMetadata: group.metadata,
							}));
						})
					: [];

				const toIstTime = (utcDate: string) =>
					new Date(utcDate).toLocaleString("en-US", {
						timeZone: "Asia/Kolkata",
						hour: "2-digit",
						minute: "2-digit",
						hour12: true,
					});

				const events = periods.data.map((period: DeviceStatusPeriod, index: number) => {
					const periodStartIso = normalizeIso(period.startTime);
					const periodEndIso = normalizeIso(period.endTime ?? new Date().toISOString());

					// 1. Try to find a match specifically from an "Event" group
					// STRICT MATCHING: Only consider items from "Event" groups.
					const matchedItem = groupItems.find((item) => {
						const itemStartMs = new Date(item.segmentStart).getTime();
						const itemEndMs = new Date(item.segmentEnd).getTime();
						const periodStartMs = new Date(period.startTime).getTime();
						const periodEndMs = new Date(period.endTime ?? new Date()).getTime();

						// Allow small buffer (1s) for time differences
						const startMatch = Math.abs(itemStartMs - periodStartMs) < 1000;
						const endMatch = Math.abs(itemEndMs - periodEndMs) < 1000;

						const isEventGroup = (item.groupMetadata as any)?.annotationType === "event";
						return startMatch && endMatch && isEventGroup;
					});
					const reasonCode = matchedItem?.metadata?.reasonCode ?? matchedItem?.notes ?? "";
					const tagsValue = (matchedItem?.metadata?.Tags ?? matchedItem?.metadata?.tags ?? "") as string;
					return {
						id: `period-${index}`,
						type: period.status,
						rawStartTime: period.startTime,
						rawEndTime: period.endTime ?? new Date().toISOString(),
						startTime: toIstTime(period.startTime),
						endTime: period.isOngoing ? "now" : toIstTime(period.endTime),
						reason: reasonCode ? String(reasonCode) : "",
						category: matchedItem?.category ?? null,
						notes: matchedItem?.notes ?? "",
						metadata: matchedItem?.metadata ?? null,
						tags: tagsValue,
						itemId: matchedItem?.id ?? null,
						groupId: matchedItem?.groupId ?? null,
					};
				});

				const found = events.find((evt) => evt.id === eventId);
				if (!found) {
					throw new Error("Event not found for selected day.");
				}

				setEventData(found);
				setReason(found.reason || "");
				setMetadata(metadataToArray(found.metadata).length ? metadataToArray(found.metadata) : [{ key: "", value: "" }]);
				setTagsText(found.tags || "");
				setNotes(found.notes || "");
			} catch (err) {
				console.error(err);
				setIsError(true);
			} finally {
				setLoading(false);
			}
		};

		if (machineId) {
			loadEvent();
		}
	}, [eventId, machineId, currentDate, currentShift]);

	// Handlers
	const handleAddMetadata = () => {
		setMetadata([...metadata, { key: "", value: "" }]);
	};

	const handleRemoveMetadata = (index: number) => {
		const newMeta = [...metadata];
		newMeta.splice(index, 1);
		setMetadata(newMeta);
	};

	const handleMetadataChange = (index: number, field: "key" | "value", val: string) => {
		const newMeta = [...metadata];
		newMeta[index][field] = val;
		setMetadata(newMeta);
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isSaving) return;
		setIsSaving(true);
		try {
			if (!machineId || machineId === "Unknown Machine") throw new Error("Invalid machine ID");
			if (!reason) throw new Error("Please select a reason code.");
			if (!eventData?.rawStartTime || !eventData?.rawEndTime) throw new Error("Missing event time range.");

			const { fromDateUTC, toDateUTC } = buildUtcRangeFromIstDate(currentDate, currentShift);
			const category = getReasonCategory(reason);
			const metadataObj = metadataFromArray(metadata);
			const metadataPayload = {
				...(metadataObj ?? {}),
				reasonCode: Number(reason),
				reasonDescription: getReasonDescription(reason),
				...(tagsText.trim() ? { Tags: tagsText.trim() } : {}),
			};
			const existingGroups = await readDeviceStateEventGroupsWithItems({
				deviceId: machineId,
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
						// Strict check for annotationType: 'event'
						const meta = group?.metadata as Record<string, unknown> | undefined;
						const isEventGroup = meta?.annotationType === "event";
						return startMs === rangeStartMs && endMs === rangeEndMs && isEventGroup;
					})
				: null;

			const itemPayload = {
				segmentStart: eventData.rawStartTime,
				segmentEnd: eventData.rawEndTime,
				state: eventData.type,
				category,
				scopeType: "DEVICE_STATUS" as const,
				notes,
				metadata: metadataPayload,
			};

			let savedGroupId: string | null = matchingGroup?.id ?? null;
			let savedItemId: string | null = eventData.itemId ?? null;
			let savedGroup: any = null;

			if (matchingGroup?.id) {
				if (eventData.itemId) {
					const updated = await updateDeviceStateEventGroupItems({
						deviceId: machineId,
						groupId: matchingGroup.id,
						items: [
							{
								id: eventData.itemId,
								segmentStart: eventData.rawStartTime,
								segmentEnd: eventData.rawEndTime,
								category,
								scopeType: "DEVICE_STATUS",
								notes,
								metadata: metadataPayload,
							},
						],
					});
					savedGroup = updated;
				} else {
					const created = await createDeviceStateEventGroupItems({
						deviceId: machineId,
						groupId: matchingGroup.id,
						items: [itemPayload],
					});
					savedGroup = created;
				}
			} else {
				const created = await createDeviceStateEventGroup({
					deviceId: machineId,
					body: {
						rangeStart: fromDateUTC.toISOString(),
						rangeEnd: toDateUTC.toISOString(),
						title: `EVENT-${fromDateUTC.toISOString().split("T")[0]}-${toDateUTC.toISOString().split("T")[0]}`,
						tags: tagsText.trim()
							? tagsText
									.split(",")
									.map((tag) => tag.trim())
									.filter(Boolean)
							: undefined,
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
						normalizeIso(item.segmentStart) === normalizeIso(eventData.rawStartTime) &&
						normalizeIso(item.segmentEnd) === normalizeIso(eventData.rawEndTime)
					);
				});
				savedItemId = matched?.id ?? savedItemId;
			}

			setEventData({
				...eventData,
				reason,
				category,
				notes,
				metadata: metadataPayload,
				tags: tagsText,
				itemId: savedItemId,
				groupId: savedGroupId,
			});

			toast.custom((t) => <CustomToast t={t} type="success" title="Save Successful" message="Event details have been saved successfully." />);

			router.back();
		} catch (error) {
			console.error("Failed to save event details:", error);
			toast.custom((t) => (
				<CustomToast
					t={t}
					type="error"
					title="Save Failed"
					message={error instanceof Error ? error.message : "Failed to save event details."}
				/>
			));
			setIsSaving(false);
		}
	};

	const isDeviceMapLoaded = eventsDevices.length > 0;

	// Removed early return for isError to preserve header

	if (loading || !eventData || !isDeviceMapLoaded) {
		return (
			<div className="flex bg-background-dashboard min-h-screen items-center justify-center">
				<Loader />
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard font-display">
			{/* Standard Context Header */}
			<AppHeader
				title={machineName}
				subtitle="Event Grouping"
				showDateNavigator={false}
				rightElement={
					<div className="flex items-center gap-3">
						{isError ? (
							<button
								onClick={() => router.back()}
								className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform"
							>
								Back
							</button>
						) : (
							<>
								<button
									onClick={() => router.back()}
									disabled={isSaving}
									className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none"
								>
									Cancel
								</button>
								<button
									type="submit"
									form="EVENT-grouping-form"
									disabled={isSaving}
									className="bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform disabled:opacity-80 disabled:pointer-events-none min-w-[60px] flex justify-center items-center"
								>
									{isSaving ? (
										<div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									) : (
										"SAVE"
									)}
								</button>
							</>
						)}
					</div>
				}
			/>

			{isError ? (
				<div className="flex-1 flex flex-col items-center justify-center -mt-20">
					<EmptyState
						icon="cloud_off"
						title="Connection Failed"
						description={
							<span>
								Unable to retrieve event details. <br />
								<span className="text-gray-400 text-xs mt-1 block">Please check your connection.</span>
							</span>
						}
						action={
							<button
								onClick={() => window.location.reload()}
								className="mt-2 h-9 px-6 rounded-lg bg-primary text-white font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-wide"
							>
								Retry
							</button>
						}
					/>
				</div>
			) : (
				<main className="!py-4 !space-y-6 !pb-24 max-w-md mx-auto w-full">
					{/* Event Details Form */}
					<section className="bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden">
						<div className="bg-gray-50 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center">
							<h3 className="font-bold text-sm uppercase tracking-wider text-primary">Event Details</h3>
							<span className="material-symbols-outlined text-gray-400 !text-lg">edit_note</span>
						</div>

						<form
							id="EVENT-grouping-form"
							className={cn("!p-4 !space-y-2", isSaving && "opacity-60 pointer-events-none")}
							onSubmit={handleSave}
						>
							{/* Title & Description */}

							{/* Times */}
							<div className="grid grid-cols-2 !gap-3">
								<div className="space-y-1.5">
									<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Start Time</label>
									<div className="relative">
										<input
											className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-bold text-gray-800 focus:ring-primary focus:border-primary"
											readOnly
											type="text"
											value={eventData.startTime}
										/>
										<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none !text-base">
											schedule
										</span>
									</div>
								</div>
								<div className="space-y-1.5">
									<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">End Time</label>
									<div className="relative">
										<input
											className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-bold text-gray-800 focus:ring-primary focus:border-primary"
											readOnly
											type="text"
											value={eventData.endTime}
										/>
										<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none !text-base">
											schedule
										</span>
									</div>
								</div>
							</div>

							{/* Reason Code */}
							<div className="space-y-1.5">
								<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Reason Code</label>
								<ReasonCodeSelect value={reason} onChange={setReason} eventType={eventData.type} />
							</div>

							{/* Metadata */}
							<div className="space-y-2 pt-1">
								<div className="flex justify-between items-center px-1">
									<label className="block text-[11px] font-bold text-gray-500 uppercase">Metadata</label>
									<button
										type="button"
										onClick={handleAddMetadata}
										className="text-[10px] font-bold text-primary hover:text-[#23465b] flex items-center gap-1 active:scale-95 transition-transform"
									>
										<span className="material-symbols-outlined !text-[14px]">add</span> ADD FIELD
									</button>
								</div>
								<div className="space-y-2">
									{metadata.map((item, index) => (
										<div key={index} className="flex gap-2 items-center">
											<input
												className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-bold text-gray-800 focus:ring-primary focus:border-primary"
												placeholder="Key"
												value={item.key}
												onChange={(e) => handleMetadataChange(index, "key", e.target.value)}
											/>
											<input
												className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-medium text-gray-800 focus:ring-primary focus:border-primary"
												placeholder="Value"
												value={item.value}
												onChange={(e) => handleMetadataChange(index, "value", e.target.value)}
											/>
											<button
												type="button"
												onClick={() => handleRemoveMetadata(index)}
												className="size-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
											>
												<span className="material-symbols-outlined !text-[18px]">delete</span>
											</button>
										</div>
									))}
								</div>
							</div>

							{/* Tags */}
							<div className="space-y-1.5 pt-1">
								<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Tags</label>
								<input
									className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-medium text-gray-800 focus:ring-primary focus:border-primary placeholder:text-gray-400"
									placeholder="tag1, tag2"
									value={tagsText}
									onChange={(e) => setTagsText(e.target.value)}
								/>
							</div>

							{/* Notes */}
							<div className="space-y-1.5 pt-1">
								<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Notes</label>
								<textarea
									className="w-full bg-gray-50 border border-gray-200 rounded-lg !p-3 !text-xs font-medium text-gray-800 focus:ring-primary focus:border-primary resize-none placeholder:text-gray-400"
									placeholder="Additional observation notes..."
									rows={3}
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
								></textarea>
							</div>
						</form>
					</section>
				</main>
			)}
		</div>
	);
}
