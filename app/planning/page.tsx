"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import AppHeader from "@/components/AppHeader";
import SearchFilterBar from "@/components/SearchFilterBar";
import EmptyState from "@/components/EmptyState";
import { useData } from "@/context/DataContext";
import type { Order } from "@/lib/types";
import { deleteDeviceStateEventGroupItems, fetchDeviceList, readDeviceStateEventGroupsWithItemsByCluster, type DeviceSummary } from "@/utils/scripts";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

type Assignment = Order & {
	workOrder?: string;
	// Non-Order fields used for delete selection + API calls
	lhtItemId?: string;
};

type ApiEventItem = {
	id?: string;
	category?: string | null;
	segmentStart?: string | null;
	segmentEnd?: string | null;
	metadata?: Record<string, unknown> | null;
};

type ApiEventGroup = {
	id?: string;
	deviceId?: string;
	rangeStart?: string | null;
	rangeEnd?: string | null;
	title?: string | null;
	Items?: ApiEventItem[] | null;
};

export default function PlanningPage() {
	const { orders, currentDate, deleteOrder } = useData();

	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState<"All" | "PLANNED">("All");
	const [filterMachine, setFilterMachine] = useState<string>("All");
	const [showFilters, setShowFilters] = useState(false);
	const [isDeleteMode, setIsDeleteMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const [devices, setDevices] = useState<DeviceSummary[]>([]);
	const [selectedDeviceId] = useState<string>("ALL");
	const [assignments, setAssignments] = useState<Assignment[] | null>(null);

	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID;
	const lhtAccountId = process.env.NEXT_PUBLIC_LHT_ACCOUNT_ID;
	const lhtApplicationId = process.env.NEXT_PUBLIC_APPLICATION_ID;

	const lighthouseEnabled = Boolean(lhtClusterId && lhtAccountId && lhtApplicationId);

	const deviceLabel = (device?: DeviceSummary) => device?.deviceName || device?.serialNumber || device?.foreignId || device?.id || "Unknown Device";

	const formatTimeValue = (value?: string | Date) => {
		if (!value) return "";
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return String(value);
		return date.toISOString().slice(11, 16);
	};

	const toLocalYYYYMMDD = (iso: string) => {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return "";
		const yyyy = String(d.getFullYear());
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	};

	const formatDateForDisplay = (dateStr: string) => {
		const date = new Date(dateStr);
		return date
			.toLocaleDateString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
			})
			.toUpperCase();
	};

	const selectionKey = (item: Assignment) => (item.lhtItemId ? `${item.id}:${item.lhtItemId}` : item.id);

	useEffect(() => {
		if (!lighthouseEnabled) return;
		if (!lhtClusterId) return;
		if (devices.length) return;
		fetchDeviceList({ clusterId: lhtClusterId })
			.then((result) => setDevices(result))
			.catch((error) => {
				console.error(error);
				toast.error("Failed to load devices");
			});
	}, [devices.length, lighthouseEnabled, lhtClusterId]);

	useEffect(() => {
		if (!lighthouseEnabled || !lhtClusterId || !lhtAccountId) {
			setAssignments(null);
			return;
		}

		const base = new Date(currentDate);
		const start = new Date(base);
		start.setHours(0, 0, 0, 0);
		const end = new Date(base);
		end.setDate(end.getDate() + 1);
		end.setHours(23, 59, 59, 999);

		readDeviceStateEventGroupsWithItemsByCluster({
			clusterId: lhtClusterId,
			applicationId: lhtApplicationId,
			account: { id: lhtAccountId },
			query: { rangeStart: start.toISOString(), rangeEnd: end.toISOString() },
			deviceId: selectedDeviceId !== "ALL" ? selectedDeviceId : undefined,
		})
			.then((groupsUnknown: unknown) => {
				const groups: ApiEventGroup[] = Array.isArray(groupsUnknown) ? (groupsUnknown as ApiEventGroup[]) : [];
				const mapped: Assignment[] = groups.flatMap((group) => {
					const rangeStart = typeof group?.rangeStart === "string" ? group.rangeStart : null;
					const rangeEnd = typeof group?.rangeEnd === "string" ? group.rangeEnd : null;
					const groupLocalDate = rangeStart ? toLocalYYYYMMDD(rangeStart) : currentDate;
					if (groupLocalDate !== currentDate) return [];

					const shift =
						rangeStart && rangeEnd && new Date(rangeStart).toDateString() !== new Date(rangeEnd).toDateString()
							? "Night Shift (S2)"
							: "Day Shift (S1)";

					const deviceId = typeof group?.deviceId === "string" ? group.deviceId : "";
					const machineName = (() => {
						if (!deviceId) return "Unknown Device";
						const device = devices.find((d) => d.id === deviceId);
						if (!device) return deviceId;
						const label = deviceLabel(device);
						return label && label !== "Unknown Device" ? label : deviceId;
					})();

					const items = Array.isArray(group?.Items) ? group.Items : [];
					return items.flatMap((item) => {
						const metadata = item?.metadata ?? {};
						const workOrder = String(metadata.workOrder ?? "");
						if (!workOrder) return [];

						const batch = Number(metadata.opBatchQty ?? 0);
						const estPart = String(metadata.estPartAdd ?? "");
						const startTimeValue = formatTimeValue(item?.segmentStart ?? undefined);
						const endTimeValue = formatTimeValue(item?.segmentEnd ?? undefined);
						const category = typeof item?.category === "string" ? String(item.category).toUpperCase() : "";
						const status: Order["status"] = category === "COMPLETED" ? "COMPLETED" : "PLANNED";
						const groupId = String(group?.id ?? workOrder);
						const itemId = String(item?.id ?? "");

						return [
							{
								id: groupId, // groupId for routing/edit
								workOrder,
								partNumber: String(metadata.partNumber ?? ""),
								machine: machineName,
								operator: String(metadata.operatorCode ?? ""),
								date: currentDate,
								shift,
								startTime: startTimeValue,
								endTime: endTimeValue,
								code: String(metadata.operatorCode ?? ""),
								opNumber: 0,
								batch,
								estPart,
								target: batch,
								status,
								lhtDeviceId: deviceId || undefined,
								lhtGroupId: groupId,
								lhtItemId: itemId,
							},
						];
					});
				});

				setAssignments(mapped);
			})
			.catch((error) => {
				console.error(error);
				toast.error("Failed to load assignments");
				setAssignments([]);
			});
	}, [currentDate, devices, lighthouseEnabled, lhtAccountId, lhtApplicationId, lhtClusterId, selectedDeviceId]);

	const sourceAssignments: Assignment[] = useMemo(() => {
		if (lighthouseEnabled) return assignments ?? [];
		return orders.map((o) => ({ ...o })) as Assignment[];
	}, [assignments, lighthouseEnabled, orders]);

	// Filter Logic
	const filteredAssignments = sourceAssignments.filter((item) => {
		if (item.date !== currentDate) return false;
		// Planning list should hide completed items.
		if ((item.status as string) === "COMPLETED") return false;

		const matchesSearch =
			item.machine.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(item.workOrder ?? item.id).toLowerCase().includes(searchQuery.toLowerCase());

		const matchesStatus = filterStatus === "All" || item.status === filterStatus;
		const matchesMachine = filterMachine === "All" || item.machine === filterMachine;
		return matchesSearch && matchesStatus && matchesMachine;
	});

	const toggleSelection = (item: Assignment) => {
		const key = selectionKey(item);
		setSelectedIds((prev) => (prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]));
	};

	const handleBatchDeleteClick = () => {
		if (selectedIds.length === 0) return;
		setShowDeleteConfirm(true);
	};

	const confirmDelete = async () => {
		try {
			if (lighthouseEnabled) {
				const selected = filteredAssignments.filter((a) => selectedIds.includes(selectionKey(a)));
				const deletions = selected.filter((a) => a.lhtDeviceId && a.lhtGroupId && a.lhtItemId);
				for (const entry of deletions) {
					await deleteDeviceStateEventGroupItems({
						deviceId: entry.lhtDeviceId!,
						groupId: entry.lhtGroupId!,
						clusterId: lhtClusterId!,
						applicationId: lhtApplicationId!,
						account: { id: lhtAccountId! },
						itemIds: [entry.lhtItemId!],
					});
				}
				toast.success(`Deleted ${deletions.length} items`);
				// Optimistic update: remove deleted items from state
				setAssignments((prev) => {
					if (!prev) return null;
					return prev.filter((a) => !selectedIds.includes(selectionKey(a)));
				});
			} else {
				selectedIds.forEach((id) => deleteOrder(id));
				toast.success(`Deleted ${selectedIds.length} items`);
			}
		} catch (e) {
			console.error(e);
			toast.error("Failed to delete assignments");
		} finally {
			setSelectedIds([]);
			setIsDeleteMode(false);
			setShowDeleteConfirm(false);
		}
	};

	const toggleDeleteMode = () => {
		const newMode = !isDeleteMode;
		setIsDeleteMode(newMode);
		if (!newMode) setSelectedIds([]);
	};

	const machineOptions = useMemo(() => {
		const machines = Array.from(new Set(sourceAssignments.map((o) => o.machine))).sort();
		return ["All", ...machines];
	}, [sourceAssignments]);

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard pb-24">
			<AppHeader title="Planning" subtitle="Shift Scheduling" showDateNavigator={true} dateNavigatorDisabled={isDeleteMode} />

			<div className="sticky top-(--header-height-expanded) z-20 bg-background-dashboard pb-3 px-4">
				<SearchFilterBar
					className="mt-3"
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					placeholder="Search assignments..."
					showFilters={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
				/>

				{showFilters && (
					<div className="mt-3 animate-in slide-in-from-top-1 fade-in duration-200 space-y-3">
						<div>
							<p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Status</p>
							<div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
								{["All", "PLANNED"].map((status) => (
									<button
										key={status}
										onClick={() => setFilterStatus(status as "All" | "PLANNED")}
										className={cn(
											"planning-filter-btn",
											filterStatus === status
												? "bg-primary border-primary text-white"
												: "bg-white border-card-border text-primary/70 hover:text-primary",
										)}
									>
										{status}
									</button>
								))}
							</div>
						</div>

						<div>
							<p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Machine</p>
							<div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
								{machineOptions.map((machine) => (
									<button
										key={machine}
										onClick={() => setFilterMachine(machine)}
										className={cn(
											"planning-filter-btn",
											filterMachine === machine
												? "bg-primary border-primary text-white"
												: "bg-white border-card-border text-primary/70 hover:text-primary",
										)}
									>
										{machine}
									</button>
								))}
							</div>
						</div>
					</div>
				)}
			</div>

			<main className="px-4 space-y-2 flex-1 flex flex-col">
				{filteredAssignments.map((item) => {
					const key = selectionKey(item);
					const displayWorkOrder = item.workOrder || item.id;
					// Use workOrder for routing if available, otherwise fallback to group ID
					const routeId = item.workOrder || item.id;
					const href = `/planning/create?id=${encodeURIComponent(routeId)}&deviceId=${encodeURIComponent(item.lhtDeviceId ?? "ALL")}&date=${encodeURIComponent(currentDate)}`;
					return (
						<Link
							key={key}
							href={isDeleteMode ? "#" : href}
							className={cn(
								"planning-card",
								isDeleteMode ? "cursor-default" : "active:scale-[0.99] hover:border-card-border border-card-border",
								selectedIds.includes(key) ? "planning-card-selected" : "border-card-border",
							)}
							onClick={(e) => {
								if (isDeleteMode) {
									e.preventDefault();
									toggleSelection(item);
								}
							}}
						>
							<div className="flex justify-between items-start gap-4">
								<div className="flex flex-col gap-0.5 flex-1">
									<div className="flex items-center gap-2">
										<h3 className="list-title">{item.machine}</h3>
										<div
											className={cn(
												"size-2 rounded-full",
												item.status === "PLANNED"
													? "bg-status-planned"
													: item.status === "COMPLETED"
														? "bg-status-completed"
														: "bg-status-default",
											)}
										></div>
									</div>

									<p className="list-subtext">
										{item.partNumber} • {displayWorkOrder}
									</p>
									<p className="list-subtext">{item.operator}</p>
								</div>

								<div className="list-metric-column">
									{isDeleteMode ? (
										<div
											className={cn(
												"size-6 rounded-full border-[1.5px] flex items-center justify-center transition-all",
												selectedIds.includes(key) ? "border-destructive bg-destructive-bg" : "border-card-border bg-white",
											)}
										>
											{selectedIds.includes(key) && (
												<div className="size-3.5 rounded-full bg-destructive shadow-sm animate-in zoom-in-75 duration-200" />
											)}
										</div>
									) : (
										<span className="list-tag text-primary bg-primary/10">
											{item.startTime} - {item.endTime}
										</span>
									)}
								</div>
							</div>
						</Link>
					);
				})}

				{filteredAssignments.length === 0 && (
					<div className="flex-1 flex flex-col items-center justify-center -mt-20">
						<EmptyState
							icon="event_busy"
							title="No Plans Found"
							description={
								<span>
									No assignments scheduled for <br />
									<span className="text-primary font-bold mt-1 block">{formatDateForDisplay(currentDate)}</span>
								</span>
							}
						/>
					</div>
				)}
			</main>

			{/* Floating Action Buttons */}
			<div className="fixed bottom-[74px] left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] pointer-events-none flex flex-col items-end gap-3 pr-4">
				{/* Confirm Delete FAB */}
				{isDeleteMode && selectedIds.length > 0 && (
					<button
						onClick={handleBatchDeleteClick}
						className="planning-fab pointer-events-auto bg-destructive shadow-[0_4px_14px_rgba(239,68,68,0.4)] animate-in zoom-in-50 duration-200 active:scale-95"
					>
						<span className="material-symbols-outlined icon-pl-fab">check</span>
					</button>
				)}

				{!isDeleteMode && (
					<Link
						href="/planning/create"
						className="planning-fab pointer-events-auto bg-primary shadow-[0_4px_14px_rgba(0,0,0,0.25)] active:scale-95"
					>
						<span className="material-symbols-outlined icon-pl-fab">add</span>
					</Link>
				)}

				<button
					onClick={toggleDeleteMode}
					className={cn(
						"rounded-full pointer-events-auto shadow-lg flex items-center justify-center transition-all duration-300 bg-white border border-gray-100",
						isDeleteMode ? "size-10 text-gray-500 hover:text-gray-800" : "size-10 text-gray-400 hover:text-destructive",
					)}
					title={isDeleteMode ? "Cancel" : "Delete Assignments"}
				>
					<span className={cn("material-symbols-outlined", isDeleteMode ? "icon-pl-action-active" : "icon-pl-action")}>
						{isDeleteMode ? "close" : "delete"}
					</span>
				</button>
			</div>

			{showDeleteConfirm && (
				<div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200">
					<div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[320px] p-6 animate-in zoom-in-95 duration-200 border border-white/20">
						<div className="size-12 rounded-full bg-destructive-bg text-destructive flex items-center justify-center mb-4 mx-auto">
							<span className="material-symbols-outlined icon-pl-modal">delete</span>
						</div>
						<h3 className="text-base font-bold text-gray-900 mb-2 text-center font-display">Delete Assignments?</h3>
						<p className="text-sm font-medium text-gray-500 mb-6 text-center leading-relaxed">
							Are you sure you want to delete <strong className="text-gray-800">{selectedIds.length}</strong> selected assignments?{" "}
							<br />
							This action cannot be undone.
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => setShowDeleteConfirm(false)}
								className="flex-1 h-11 flex items-center justify-center rounded-xl bg-background-dashboard text-gray-600 font-bold text-sm hover:bg-gray-100 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={confirmDelete}
								className="flex-1 h-11 flex items-center justify-center rounded-xl bg-destructive text-white font-bold text-sm hover:bg-red-600 shadow-md transition-all active:scale-95"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
