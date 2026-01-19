"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Link from "next/link";
import { ReasonCodeSelect } from "@/components/ReasonCodeSelect";
import { useData } from "@/context/DataContext";
import { fetchDeviceList } from "@/utils/scripts";
import AppHeader from "@/components/AppHeader";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const getContextTime = (timeStr: string, offsetMinutes: number) => {
	if (!timeStr) return "";
	const [hours, minutes] = timeStr.split(":").map(Number);
	const date = new Date();
	date.setHours(hours, minutes + offsetMinutes);
	return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const getMockEventDetails = (eventId: string, machineId: string) => {
	// This function simulates an API call or DB lookup
	// It returns different data based on the ID to show dynamic functionality

	const baseDate = new Date().toISOString().split("T")[0]; // Today

	const mockDatabase: Record<string, any> = {
		"ev-101": {
			id: "ev-101",
			title: "Unexpected Stop",
			description: "Machine stopped without signal.",
			startTime: "10:30",
			endTime: "10:45",
			date: baseDate,
			duration: "15m",
			reason: "", // Untagged
			metadata: [],
			tags: ["Urgent"],
			type: "Untagged",
		},
		"ev-102": {
			id: "ev-102",
			title: "System Offline",
			description: "Network connectivity lost detected.",
			startTime: "08:00",
			endTime: "08:20",
			date: baseDate,
			duration: "20m",
			reason: "Sensor Failure",
			metadata: [
				{ key: "Error Code", value: "E-505" },
				{ key: "Region", value: "North-1" },
			],
			tags: ["Maintenance", "Network"],
			type: "Offline",
		},
		"ev-103": {
			id: "ev-103",
			title: "Tool Change Operation",
			description: "Scheduled tool replacement for wear.",
			startTime: "09:15",
			endTime: "09:45",
			date: baseDate,
			duration: "30m",
			reason: "No Operator", // Example mapping
			metadata: [
				{ key: "Operator", value: "S. Kumar" },
				{ key: "Tool ID", value: "T-99" },
			],
			tags: ["Planned", "Shift-1"],
			type: "Logged",
		},
		"ev-099": {
			id: "ev-099",
			title: "Maintenance Log",
			description: "Preventative maintenance routine.",
			startTime: "14:00",
			endTime: "14:20",
			date: "2025-01-01",
			duration: "20m",
			reason: "Breakdown",
			metadata: [{ key: "Technician", value: "Mike R." }],
			tags: ["History", "Maintenance"],
			type: "Logged",
		},
	};

	// Fallback if ID not found (New/Unknown event)
	return (
		mockDatabase[eventId] || {
			id: eventId,
			title: "New Detected Event",
			description: "",
			startTime: "12:00",
			endTime: "12:15",
			date: baseDate,
			duration: "15m",
			reason: "",
			metadata: [{ key: "Machine", value: machineId }],
			tags: [],
			type: "Untagged",
		}
	);
};

export default function EventGroupingPage() {
	const router = useRouter();
	const params = useParams();
	// Safety check for params
	const machineId = params?.id && typeof params.id === "string" ? decodeURIComponent(params.id) : "Unknown Machine";
	const eventId = params?.eventId && typeof params.eventId === "string" ? decodeURIComponent(params.eventId) : "unknown";

	const { eventsDevices, setEventsDevices } = useData();
	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID ?? "";

	// Fetch devices if not present
	useEffect(() => {
		if (!lhtClusterId) return;
		if (eventsDevices.length > 0) return;

		fetchDeviceList({ clusterId: lhtClusterId }).then(setEventsDevices).catch(console.error);
	}, [lhtClusterId, eventsDevices.length, setEventsDevices]);

	const machineName = React.useMemo(() => {
		const device = eventsDevices.find((d) => d.id === machineId);
		return device?.deviceName || machineId;
	}, [eventsDevices, machineId]);

	const [loading, setLoading] = useState(true);
	const [isError, setIsError] = useState(false);

	// Form State
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [reason, setReason] = useState("");
	const [metadata, setMetadata] = useState<{ key: string; value: string }[]>([]);
	const [notes, setNotes] = useState("");
	const [tags, setTags] = useState<string[]>([]);
	const [newTag, setNewTag] = useState("");
	const [eventData, setEventData] = useState<any>(null);

	// Initialize Data
	useEffect(() => {
		const data = getMockEventDetails(eventId, machineId);
		setEventData(data);

		// Populate Form
		setTitle(data.title);
		setDescription(data.description);
		setReason(data.reason);
		setMetadata(data.metadata && data.metadata.length > 0 ? data.metadata : [{ key: "", value: "" }]);
		setTags(data.tags);

		setLoading(false);
	}, [eventId, machineId]);

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

	const handleAddTag = () => {
		if (newTag.trim()) {
			setTags([...tags, newTag.trim()]);
			setNewTag("");
		}
	};

	const handleRemoveTag = (tagToRemove: string) => {
		setTags(tags.filter((t) => t !== tagToRemove));
	};

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault();
		// Here you would typically POST the data to your backend
		console.log("Saving Event:", {
			id: eventId,
			machineId,
			title,
			description,
			reason,
			metadata,
			tags,
			notes,
		});
		router.back();
	};

	const isDeviceMapLoaded = !lhtClusterId || eventsDevices.length > 0;

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
									className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform"
								>
									Cancel
								</button>
								<button
									type="submit"
									form="event-grouping-form"
									className="bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform"
								>
									SAVE
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

						<form id="event-grouping-form" className="!p-4 !space-y-2" onSubmit={handleSave}>
							{/* Title & Description */}
							<div className="space-y-3">
								<div className="space-y-1.5">
									<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Group Title</label>
									<input
										className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-bold text-gray-800 focus:ring-primary focus:border-primary transition-colors placeholder:text-gray-400 font-medium"
										placeholder="Enter group title"
										type="text"
										value={title}
										onChange={(e) => setTitle(e.target.value)}
									/>
								</div>
								<div className="space-y-1.5">
									<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Description</label>
									<textarea
										className="w-full bg-gray-50 border border-gray-200 rounded-lg !p-3 text-xs font-bold text-gray-800 focus:ring-primary focus:border-primary transition-colors placeholder:text-gray-400 font-medium resize-none"
										placeholder="Brief description"
										rows={3}
										value={description}
										onChange={(e) => setDescription(e.target.value)}
									/>
								</div>
							</div>

							{/* Times */}
							<div className="grid grid-cols-2 !gap-3">
								<div className="space-y-1.5">
									<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Start Time</label>
									<div className="relative">
										<input
											className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-bold text-gray-800 focus:ring-primary focus:border-primary"
											readOnly
											type="text"
											value={`${eventData.startTime} AM`}
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
											value={`${eventData.endTime} AM`}
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
								<div className="relative flex gap-2">
									<input
										className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs font-medium text-gray-800 focus:ring-primary focus:border-primary placeholder:text-gray-400"
										placeholder="Add new tag..."
										value={newTag}
										onChange={(e) => setNewTag(e.target.value)}
										onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
									/>
									<button
										type="button"
										onClick={handleAddTag}
										className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 font-bold text-xs px-3 rounded-lg shadow-sm transition-colors active:scale-95"
									>
										ADD
									</button>
								</div>
								<div className="flex flex-wrap gap-2 mt-2">
									{tags.map((tag) => (
										<span
											key={tag}
											className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-gray-200 text-[11px] font-bold text-gray-600 shadow-sm"
										>
											{tag}
											<button
												type="button"
												onClick={() => handleRemoveTag(tag)}
												className="hover:text-red-500 flex items-center text-gray-400 transition-colors"
											>
												<span className="material-symbols-outlined !text-[14px]">close</span>
											</button>
										</span>
									))}
								</div>
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
