"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import AppHeader from "@/components/AppHeader";
import SearchFilterBar from "@/components/SearchFilterBar";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import Select from "@/components/ui/Select";
import { useData } from "@/context/DataContext";
import type { Order, Assignment } from "@/lib/types";
import {
	createDeviceStateEventGroup,
	createDeviceStateEventGroupItems,
	updateDeviceStateEventGroupItems,
	deleteDeviceStateEventGroupItems,
	deleteDeviceStateEventGroupItemsManyByCluster,
	fetchDeviceList,
	readDeviceStateEventGroupsWithItemsByCluster,
	type DeviceSummary,
} from "@/utils/scripts";
import { formatTimeToIST } from "@/utils/dateUtils";
import { fetchErpSchedule } from "@/app/actions/erp";
import { STORAGE_KEY } from "@/components/AuthGuard";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

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
	const router = useRouter();
	const {
		orders,
		currentDate,
		deleteOrder,
		globalAssignments,
		setGlobalAssignments,
		globalDevices,
		setGlobalDevices,
		globalDataDate,
		setGlobalDataDate,
		currentShift,
	} = useData();

	const [searchQuery, setSearchQuery] = useState("");
	const [filterOperator, setFilterOperator] = useState<string>("All");
	const [filterMachine, setFilterMachine] = useState<string>("All");
	const [showFilters, setShowFilters] = useState(false);
	const [isDeleteMode, setIsDeleteMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const [selectedDeviceId] = useState<string>("ALL");

	// Local loading state just for the initial fetch trigger visual
	const [isLoading, setIsLoading] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);

	const [isError, setIsError] = useState(false);
	const deviceFetchRef = React.useRef(false);

	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID;
	const lhtAccountId = process.env.NEXT_PUBLIC_LHT_ACCOUNT_ID;
	const lhtApplicationId = process.env.NEXT_PUBLIC_APPLICATION_ID;

	const lighthouseEnabled = Boolean(lhtClusterId && lhtAccountId && lhtApplicationId);

	const deviceLabel = (device?: DeviceSummary) => device?.deviceName || device?.serialNumber || device?.foreignId || device?.id || "Unknown Device";

	const formatTimeValue = (value?: string | Date) => {
		if (!value) return "";
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return String(value);
		return formatTimeToIST(date);
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

	// Sync Button Handler
	const handleSync = () => {
		router.push("/planning/sync");
	};

	const handleLogout = () => {
		localStorage.removeItem(STORAGE_KEY);
		router.replace("/login");
	};

	useEffect(() => {
		if (!lighthouseEnabled) return;
		if (!lhtClusterId) return;
		// If we already have devices in context, don't refetch
		if (globalDevices.length) return;
		if (deviceFetchRef.current) return;
		deviceFetchRef.current = true;

		fetchDeviceList({ clusterId: lhtClusterId })
			.then((result) => setGlobalDevices(result))
			.catch((error) => {
				console.error(error);
				toast.error("Failed to load orders");
				setIsError(true);
			});
	}, [globalDevices.length, lighthouseEnabled, lhtClusterId, setGlobalDevices]);

	// Reset error when date changes
	useEffect(() => {
		setIsError(false);
	}, [currentDate]);

	useEffect(() => {
		if (!lighthouseEnabled || !lhtClusterId || !lhtAccountId) {
			// Only clear if we really need to, but keeping it persistent is better.
			return;
		}

		// Wait for devices to be loaded before fetching assignments to avoid ID flash
		if (lighthouseEnabled && !globalDevices.length) {
			return;
		}

		if (isError) return;

		// Check if data is already loaded for this date and shift
		if (globalDataDate === `${currentDate}:${currentShift}` && globalAssignments) {
			return;
		}

		setIsLoading(true);

		// Calculate shift-based range
		let start, end;
		const [y, m, day] = currentDate.split("-").map(Number);
		const istOffset = 5.5 * 3600 * 1000;

		if (currentShift === "Day") {
			// Day Shift: 8AM to 8PM
			const dayStartUTC = Date.UTC(y, m - 1, day, 8, 0, 0) - istOffset;
			const dayEndUTC = Date.UTC(y, m - 1, day, 20, 0, 0) - istOffset;
			start = new Date(dayStartUTC).toISOString();
			end = new Date(dayEndUTC).toISOString();
		} else {
			// Night Shift: 8PM to 8AM Next Day
			const nightStartUTC = Date.UTC(y, m - 1, day, 20, 0, 0) - istOffset;
			const nightEndUTC = Date.UTC(y, m - 1, day + 1, 8, 0, 0) - istOffset;
			start = new Date(nightStartUTC).toISOString();
			end = new Date(nightEndUTC).toISOString();
		}

		let cancelled = false;

		readDeviceStateEventGroupsWithItemsByCluster({
			clusterId: lhtClusterId,
			applicationId: lhtApplicationId,
			account: { id: lhtAccountId },
			query: { rangeStart: start, rangeEnd: end },
			// Fetch ALL devices now, filter locally if needed.
			deviceId: undefined,
		})
			.then((groupsUnknown: unknown) => {
				if (cancelled) return;
				const groups: ApiEventGroup[] = Array.isArray(groupsUnknown) ? (groupsUnknown as ApiEventGroup[]) : [];
				const mapped: Assignment[] = groups.flatMap((group) => {
					const groupShift = currentShift === "Day" ? "Day Shift (S1)" : "Night Shift (S2)";

					const deviceId = typeof group?.deviceId === "string" ? group.deviceId : "";
					const machineName = (() => {
						if (!deviceId) return "Unknown Device";
						const device = globalDevices.find((d) => d.id === deviceId);
						if (!device) return deviceId;
						const label = deviceLabel(device);
						return label && label !== "Unknown Device" ? label : deviceId;
					})();

					const items = Array.isArray(group?.Items) ? group.Items : [];
					const rangeStartMs = new Date(start!).getTime();
					const rangeEndMs = new Date(end!).getTime();

					return items.flatMap((item) => {
						const segmentStart = item?.segmentStart ? new Date(item.segmentStart).getTime() : 0;
						if (segmentStart < rangeStartMs || segmentStart >= rangeEndMs) return [];

						const metadata = item?.metadata ?? {};
						const workOrder = String(metadata.workOrder ?? "");
						if (!workOrder) return [];

						const batch = Number(metadata.opBatchQty ?? 0);
						const estPart = String(metadata.estPartAdd ?? "");
						const startTimeValue = formatTimeValue(item?.segmentStart ?? undefined);
						const endTimeValue = formatTimeValue(item?.segmentEnd ?? undefined);
						const category = typeof item?.category === "string" ? String(item.category).toUpperCase() : "";
						const status: Order["status"] = category === "ACTUAL_OUTPUT" ? "ACTUAL_OUTPUT" : "PLANNED_OUTPUT";
						const groupId = String(group?.id ?? workOrder);
						const itemId = String(item?.id ?? "");

						const rawOp = metadata.opNumber ?? "0";
						const opNumber = Array.isArray(rawOp) ? rawOp.map(String) : [String(rawOp)];

						return [
							{
								id: groupId, // groupId for routing/edit
								workOrder,
								partNumber: String(metadata.partNumber ?? ""),
								machine: machineName,
								operator: String(metadata.operatorName ?? metadata.operator ?? metadata.name ?? ""),
								date: currentDate,
								shift: groupShift,
								startTime: startTimeValue,
								endTime: endTimeValue,
								code: String(metadata.operatorCode ?? ""),
								opNumber,
								batch,
								estPart,
								target: batch,
								status,
								lhtDeviceId: deviceId || undefined,
								lhtGroupId: groupId,
								lhtItemId: itemId,
								importedFrom: String(metadata.importedFrom ?? ""),
								uniqueIdentifier: String(metadata.uniqueIdentifier ?? ""),
							},
						];
					});
				});

				setGlobalAssignments(mapped);
				setGlobalDataDate(`${currentDate}:${currentShift}`);
			})
			.catch((error) => {
				if (cancelled) return;
				console.error(error);
				setGlobalAssignments([]);
				setIsError(true);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [
		isError,
		currentDate,
		globalDevices,
		lighthouseEnabled,
		lhtAccountId,
		lhtApplicationId,
		lhtClusterId,
		selectedDeviceId,
		globalAssignments,
		setGlobalAssignments,
		globalDataDate,
		setGlobalDataDate,
		currentShift,
	]);

	const sourceAssignments: Assignment[] = useMemo(() => {
		if (lighthouseEnabled) return globalAssignments ?? [];
		return orders.map((o) => ({ ...o })) as Assignment[];
	}, [globalAssignments, lighthouseEnabled, orders]);

	// Filter Logic
	const filteredAssignments = sourceAssignments.filter((item) => {
		// If using shift-based fetching, we don't strictly need to filter by date anymore as API does it,
		// but let's keep it consistent.

		// Planning list should hide completed items.
		if ((item.status as string) === "ACTUAL_OUTPUT") return false;

		const matchesSearch =
			item.machine.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(item.workOrder ?? item.id).toLowerCase().includes(searchQuery.toLowerCase());

		const matchesOperator = filterOperator === "All" || item.operator === filterOperator;
		const matchesMachine = filterMachine === "All" || item.machine === filterMachine;
		return matchesSearch && matchesOperator && matchesMachine;
	});

	const toggleSelection = (item: Assignment) => {
		const key = selectionKey(item);
		setSelectedIds((prev) => (prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]));
	};

	const hasLinkedStock = (item: Assignment) => {
		if (!lighthouseEnabled) return false;
		return sourceAssignments.some((a) => {
			if (a.status !== "ACTUAL_OUTPUT") return false;
			if (a.workOrder !== item.workOrder) return false;
			// Check if opNumbers match
			const opA = (a.opNumber || []).sort().join(",");
			const opB = (item.opNumber || []).sort().join(",");
			return opA === opB;
		});
	};

	const handleBatchDeleteClick = () => {
		if (selectedIds.length === 0) return;
		setShowDeleteConfirm(true);
	};

	const confirmDelete = async () => {
		setIsDeleting(true);
		try {
			if (lighthouseEnabled) {
				const selected = filteredAssignments.filter((a) => selectedIds.includes(selectionKey(a)));
				const deletions = selected.filter((a) => a.lhtDeviceId && a.lhtGroupId && a.lhtItemId);
				const itemsToDelete = deletions.map((a) => ({ deviceId: a.lhtDeviceId!, itemId: a.lhtItemId! }));

				if (itemsToDelete.length > 0) {
					await deleteDeviceStateEventGroupItemsManyByCluster({
						clusterId: lhtClusterId!,
						applicationId: lhtApplicationId!,
						account: { id: lhtAccountId! },
						items: itemsToDelete,
					});
				}
				toast.success(`Deleted ${deletions.length} items`);
				// Optimistic update: remove deleted items from state
				setGlobalAssignments((prev) => {
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
			setIsDeleting(false);
		}
	};

	const toggleDeleteMode = () => {
		const newMode = !isDeleteMode;
		setIsDeleteMode(newMode);
		if (!newMode) setSelectedIds([]);
	};

	const machineOptions = useMemo(() => {
		const machines = Array.from(new Set(sourceAssignments.map((o) => o.machine)))
			.filter(Boolean)
			.sort();
		return ["All", ...machines];
	}, [sourceAssignments]);

	const operatorOptions = useMemo(() => {
		const operators = Array.from(new Set(sourceAssignments.map((o) => o.operator)))
			.filter(Boolean)
			.sort();
		return ["All", ...operators];
	}, [sourceAssignments]);

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard pb-24">
			<AppHeader
				title="Planning"
				subtitle="Shift Scheduling"
				showDateNavigator={true}
				dateNavigatorDisabled={isDeleteMode}
				rightElement={
					<div className="flex items-center gap-2">
						<button
							onClick={handleSync}
							disabled={isLoading}
							className={cn(
								"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
								isSyncing
									? "bg-gray-100 text-gray-400 cursor-not-allowed"
									: "bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105 active:scale-95",
							)}
							title="Sync with ERP"
						>
							<span className={cn("material-symbols-outlined text-[18px]", isSyncing && "animate-spin")}>
								{isSyncing ? "sync" : "cloud_sync"}
							</span>
							<span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync"}</span>
						</button>
						<div className="h-4 w-px bg-gray-300 mx-1" />
						<button
							onClick={handleLogout}
							className="p-0.5 rounded-md active:scale-75 transition-transform hover:bg-gray-50 flex items-center justify-center"
						>
							<span className="material-symbols-outlined !text-[19px] text-primary">logout</span>
						</button>
					</div>
				}
			/>

			<div className="sticky top-(--header-height-expanded) z-20 bg-background-dashboard pb-2 px-4">
				<SearchFilterBar
					className="mt-2"
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					placeholder="Search assignments..."
					showFilters={showFilters}
					onToggleFilters={() => {
						if (showFilters) {
							setFilterOperator("All");
							setFilterMachine("All");
						}
						setShowFilters(!showFilters);
					}}
				/>

				{showFilters && (
					<div className="mt-2 animate-in slide-in-from-top-1 fade-in duration-200 grid grid-cols-[140px_1fr] gap-3 items-end">
						<div>
							<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Operator</p>
							<div className="relative">
								<Select
									value={filterOperator}
									onChange={setFilterOperator}
									options={operatorOptions}
									placeholder="All"
									className="w-full h-8 bg-white rounded-md text-xs"
								/>
							</div>
						</div>

						<div>
							<p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Machine</p>
							<div className="relative">
								<Select
									value={filterMachine}
									onChange={setFilterMachine}
									options={machineOptions}
									placeholder="All"
									className="w-full h-8 bg-white rounded-md text-xs"
								/>
							</div>
						</div>
					</div>
				)}
			</div>

			<main className="px-4 space-y-2 flex-1 flex flex-col">
				{/* Show loader if we are fetching new data (date mismatch) OR if devices not loaded */}
				{isError ? (
					<div className="flex-1 flex flex-col items-center justify-center -mt-20">
						<EmptyState
							icon="cloud_off"
							title="Connection Failed"
							description={
								<span>
									Unable to retrieve planning data. <br />
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
				) : isLoading ||
				  (lighthouseEnabled && globalAssignments === null) ||
				  globalDataDate !== `${currentDate}:${currentShift}` ||
				  (lighthouseEnabled && !globalDevices.length) ? (
					<div className="flex-1 flex flex-col justify-center">
						<Loader />
					</div>
				) : (
					<>
						{filteredAssignments.map((item) => {
							const key = selectionKey(item);
							const displayWorkOrder = item.workOrder || item.id;
							// Use workOrder for routing if available, otherwise fallback to group ID
							const routeId = item.id;
							const href = `/planning/create?id=${encodeURIComponent(routeId)}&deviceId=${encodeURIComponent(item.lhtDeviceId ?? "ALL")}&date=${encodeURIComponent(currentDate)}`;

							const isCompletedInStock = hasLinkedStock(item);
							const isDisabled = isDeleteMode && isCompletedInStock;

							return (
								<Link
									key={key}
									href={isDeleteMode ? "#" : href}
									className={cn(
										"planning-card",
										isDisabled
											? "opacity-50 cursor-not-allowed"
											: isDeleteMode
												? "cursor-default"
												: "active:scale-[0.99] hover:border-card-border border-card-border",
										selectedIds.includes(key) ? "planning-card-selected" : "border-card-border",
									)}
									onClick={(e) => {
										if (isDeleteMode) {
											e.preventDefault();
											if (isCompletedInStock) {
												toast.error("Cannot delete this order as it has already been completed in Stock.");
												return;
											}
											toggleSelection(item);
										}
									}}
								>
									<div className="flex justify-between items-start gap-4">
										<div className="flex flex-col gap-0.5 flex-1">
											<h3 className="list-title">
												{displayWorkOrder || "N/A"} • {item.code || "N/A"}
												<span
													className={cn(
														"inline-block ml-2 size-2 rounded-full mb-0.5",
														item.status === "PLANNED_OUTPUT"
															? "bg-status-planned"
															: item.status === "ACTUAL_OUTPUT"
																? "bg-status-completed"
																: "bg-status-default",
													)}
												/>
											</h3>

											<p className="list-subtext">
												{item.partNumber || "N/A"} • {item.operator || "N/A"}
											</p>
											<p className="list-subtext">{item.machine || "N/A"}</p>
										</div>

										<div className="list-metric-column">
											{isDeleteMode ? (
												<div
													className={cn(
														"size-6 rounded-full border-[1.5px] flex items-center justify-center transition-all",
														selectedIds.includes(key)
															? "border-destructive bg-destructive-bg"
															: "border-card-border bg-white",
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
					</>
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
								disabled={isDeleting}
							>
								Cancel
							</button>
							<button
								onClick={confirmDelete}
								className="flex-1 h-11 flex items-center justify-center rounded-xl bg-destructive text-white font-bold text-sm hover:bg-red-600 shadow-md transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
								disabled={isDeleting}
							>
								{isDeleting ? (
									<div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								) : (
									"Delete"
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
