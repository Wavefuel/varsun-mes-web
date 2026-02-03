"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import Loader from "@/components/Loader";
import { useData } from "@/context/DataContext";
import {
	createDeviceStateEventGroup,
	createDeviceStateEventGroupItems,
	updateDeviceStateEventGroupItems,
	deleteDeviceStateEventGroupItemsManyByCluster,
} from "@/utils/scripts";
import { fetchErpSchedule } from "@/app/actions/erp";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

interface SyncChangeItem {
	id: string;
	type: "ADD" | "UPDATE" | "DELETE";
	title: string;
	subtitle: string;
	diff?: string;
	payload: any;
}

type TabType = "ALL" | "ADD" | "UPDATE" | "DELETE";

export default function PlanningSyncPage() {
	const router = useRouter();
	const { currentDate, currentShift, globalAssignments, globalDevices, setGlobalDataDate } = useData();

	const [isLoading, setIsLoading] = useState(true);
	const [changes, setChanges] = useState<{
		adds: SyncChangeItem[];
		updates: SyncChangeItem[];
		deletes: SyncChangeItem[];
	}>({ adds: [], updates: [], deletes: [] });

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [isExecuting, setIsExecuting] = useState(false);

	// Filters
	const [activeTab, setActiveTab] = useState<TabType>("ALL");
	const [searchQuery, setSearchQuery] = useState("");

	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID;
	const lhtAccountId = process.env.NEXT_PUBLIC_LHT_ACCOUNT_ID;
	const lhtApplicationId = process.env.NEXT_PUBLIC_APPLICATION_ID;

	// Run analysis on mount
	useEffect(() => {
		if (!globalDevices.length) return; // Wait for context
		analyzeSync();
	}, [globalDevices, globalAssignments]);

	const analyzeSync = async () => {
		setIsLoading(true);
		try {
			if (!lhtClusterId || !lhtAccountId || !lhtApplicationId) {
				toast.error("Lighthouse configuration missing");
				return;
			}

			const erpShiftCode = currentShift === "Night" ? "E" : "D";
			const erpData = await fetchErpSchedule(currentDate, erpShiftCode);

			console.log("ERP Data:", erpData);

			if (!Array.isArray(erpData)) {
				toast.error("Invalid ERP Data");
				return;
			}

			const existingErpAssignments = globalAssignments?.filter((a) => a.importedFrom === "ERP") ?? [];
			const processedIds = new Set<string>();

			const newAdds: SyncChangeItem[] = [];
			const newUpdates: SyncChangeItem[] = [];
			const newDeletes: SyncChangeItem[] = [];

			for (const item of erpData) {
				const rawItem = item as any;
				const ShiftCode = rawItem.ShiftCode;
				const WorkdayCode = rawItem.WorkdayCode;

				if (ShiftCode === "G") continue;
				if (WorkdayCode !== currentDate) continue;

				const isDayView = currentShift === "Day";
				if (isDayView && ShiftCode !== "D") continue;
				if (!isDayView && ShiftCode !== "E") continue;

				console.log("Raw Item:", rawItem);

				const WorkOrder = String(rawItem.RouteCardNbr || "");
				const ProcessID = String(rawItem.ProcessID || "");
				const OperatorCode = String(rawItem.OperatorCode || "");
				const PartNumber = String(rawItem.ItemCode || "");
				const QtyPlanned = Number(rawItem.QtyPlanned || 0);
				const WorkCenterCode = String(rawItem.WorkCenterCode || "");

				if (!WorkOrder) continue;

				const device = globalDevices.find((d) => d.foreignId === WorkCenterCode);
				if (!device) continue;

				// Timestamps
				const [y, m, day] = currentDate.split("-").map(Number);
				const istOffset = 5.5 * 3600 * 1000;
				let rangeStartMs, rangeEndMs;
				if (ShiftCode === "D") {
					rangeStartMs = Date.UTC(y, m - 1, day, 8, 0, 0) - istOffset;
					rangeEndMs = Date.UTC(y, m - 1, day, 20, 0, 0) - istOffset;
				} else {
					rangeStartMs = Date.UTC(y, m - 1, day, 20, 0, 0) - istOffset;
					rangeEndMs = Date.UTC(y, m - 1, day + 1, 8, 0, 0) - istOffset;
				}
				const startIso = new Date(rangeStartMs).toISOString();
				const endIso = new Date(rangeEndMs).toISOString();

				// Match
				const uniqueKey = `${WorkCenterCode}-${PartNumber}-${WorkOrder}`;
				const existingMatch = existingErpAssignments.find((a) => a.uniqueIdentifier === uniqueKey);

				const commonMetadata = {
					workOrder: WorkOrder,
					partNumber: PartNumber,
					operator: "",
					operatorName: "",
					operatorCode: OperatorCode,
					opNumber: [ProcessID],
					opBatchQty: QtyPlanned,
					estPartAdd: "",
					annotationType: "PLANNING",
					importedFrom: "ERP",
					uniqueIdentifier: uniqueKey,
				};

				if (existingMatch) {
					processedIds.add(existingMatch.lhtItemId ?? "unknown");

					const hasChanged =
						existingMatch.batch !== QtyPlanned || existingMatch.code !== OperatorCode || !existingMatch.opNumber?.includes(ProcessID);

					if (hasChanged && existingMatch.lhtGroupId && existingMatch.lhtItemId) {
						newUpdates.push({
							id: uniqueKey,
							type: "UPDATE",
							title: `${WorkOrder} • ${PartNumber}`,
							subtitle: `${device.deviceName} (Op: ${ProcessID})`,
							diff: `Qty: ${existingMatch.batch} → ${QtyPlanned}`,
							payload: {
								deviceId: device.id,
								groupId: existingMatch.lhtGroupId,
								items: [
									{
										id: existingMatch.lhtItemId,
										segmentStart: startIso,
										segmentEnd: endIso,
										metadata: commonMetadata,
									},
								],
							},
						});
					}
				} else {
					newAdds.push({
						id: uniqueKey,
						type: "ADD",
						title: `${WorkOrder} • ${PartNumber}`,
						subtitle: `${device.deviceName} (Op: ${ProcessID})`,
						diff: `New Order (Qty: ${QtyPlanned})`,
						payload: {
							deviceId: device.id,
							startIso,
							endIso,
							metadata: commonMetadata,
						},
					});
				}
			}

			// Deletes
			existingErpAssignments.forEach((a) => {
				if (a.lhtItemId && !processedIds.has(a.lhtItemId)) {
					const uniqueKey = a.uniqueIdentifier || `${a.lhtDeviceId}-${a.partNumber}-${a.workOrder}`;
					newDeletes.push({
						id: a.lhtItemId || "unknown",
						type: "DELETE",
						title: `${a.workOrder} • ${a.partNumber}`,
						subtitle: `${a.machine} • Was Qty: ${a.batch}`,
						payload: {
							deviceId: a.lhtDeviceId,
							itemId: a.lhtItemId,
						},
					});
				}
			});

			setChanges({ adds: newAdds, updates: newUpdates, deletes: newDeletes });

			// Select all by default
			const allIds = new Set([...newAdds.map((i) => i.id), ...newUpdates.map((i) => i.id), ...newDeletes.map((i) => i.id)]);
			setSelectedIds(allIds);
		} catch (err: any) {
			console.error(err);
			toast.error(err.message);
		} finally {
			setIsLoading(false);
		}
	};

	const executeSync = async () => {
		setIsExecuting(true);
		try {
			// Filter selected
			const adds = changes.adds.filter((i) => selectedIds.has(i.id));
			const updates = changes.updates.filter((i) => selectedIds.has(i.id));
			const deletes = changes.deletes.filter((i) => selectedIds.has(i.id));

			let addCount = 0,
				updateCount = 0,
				deleteCount = 0;

			// Updates
			for (const item of updates) {
				const p = item.payload;
				await updateDeviceStateEventGroupItems({
					clusterId: lhtClusterId!,
					applicationId: lhtApplicationId!,
					deviceId: p.deviceId,
					account: { id: lhtAccountId! },
					groupId: p.groupId,
					items: p.items,
				});
				updateCount++;
			}

			// Deletes
			const deleteItems = deletes.map((d) => ({ deviceId: d.payload.deviceId, itemId: d.payload.itemId }));
			if (deleteItems.length > 0) {
				await deleteDeviceStateEventGroupItemsManyByCluster({
					clusterId: lhtClusterId!,
					applicationId: lhtApplicationId!,
					account: { id: lhtAccountId! },
					items: deleteItems,
				});
				deleteCount = deleteItems.length;
			}

			// Adds
			for (const item of adds) {
				const { deviceId, metadata, startIso, endIso } = item.payload;

				const targetGroup = globalAssignments?.find(
					(g) =>
						g.lhtDeviceId === deviceId &&
						g.date === currentDate &&
						g.shift === (currentShift === "Day" ? "Day Shift (S1)" : "Night Shift (S2)") &&
						g.lhtGroupId,
				);

				if (targetGroup?.lhtGroupId) {
					await createDeviceStateEventGroupItems({
						clusterId: lhtClusterId!,
						applicationId: lhtApplicationId!,
						deviceId,
						account: { id: lhtAccountId! },
						groupId: targetGroup.lhtGroupId,
						items: [
							{
								segmentStart: startIso,
								segmentEnd: endIso,
								category: "PLANNED_OUTPUT",
								metadata,
							},
						],
					});
				} else {
					await createDeviceStateEventGroup({
						clusterId: lhtClusterId!,
						applicationId: lhtApplicationId!,
						deviceId,
						account: { id: lhtAccountId! },
						body: {
							rangeStart: startIso,
							rangeEnd: endIso,
							title: `PLANNED_OUTPUT-${currentDate}`,
							items: [
								{
									segmentStart: startIso,
									segmentEnd: endIso,
									category: "PLANNED_OUTPUT",
									metadata,
								},
							],
						},
					});
				}
				addCount++;
			}

			toast.success(`Synced: +${addCount}, ~${updateCount}, -${deleteCount}`);
			setGlobalDataDate(""); // Force refresh
			router.push("/planning"); // Go back
		} catch (e: any) {
			console.error(e);
			toast.error("Sync failed: " + e.message);
		} finally {
			setIsExecuting(false);
		}
	};

	const toggleId = (id: string) => {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) newSet.delete(id);
		else newSet.add(id);
		setSelectedIds(newSet);
	};

	const hasNoChanges = changes.adds.length === 0 && changes.updates.length === 0 && changes.deletes.length === 0;

	// Combine all changes into a single list for rendering
	const flatChanges = useMemo(() => [...changes.adds, ...changes.updates, ...changes.deletes], [changes]);

	const filteredChanges = useMemo(() => {
		let filtered = flatChanges;

		// 1. Tab Filter
		if (activeTab !== "ALL") {
			filtered = filtered.filter((item) => item.type === activeTab);
		}

		// 2. Search Filter
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			filtered = filtered.filter((item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q));
		}

		return filtered;
	}, [flatChanges, activeTab, searchQuery]);

	const totalAdds = changes.adds.length;
	const totalUpdates = changes.updates.length;
	const totalDeletes = changes.deletes.length;

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard font-display">
			{/* Sticky Header */}
			<header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-(--header-height) px-4 py-2 shadow-sm">
				<div className="flex items-center justify-between h-full">
					<div className="flex flex-col">
						<h2 className="header-title">ERP Sync Review</h2>
						<p className="header-subtitle mt-0.5 uppercase block">
							{currentDate} • {currentShift} Shift
						</p>
					</div>
					<div className="flex items-center gap-3">
						<button
							onClick={() => router.back()}
							disabled={isExecuting}
							className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none"
						>
							Back
						</button>
						{!isLoading && !hasNoChanges && (
							<button
								onClick={executeSync}
								disabled={isExecuting || selectedIds.size === 0}
								className="bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform disabled:opacity-70 disabled:pointer-events-none min-w-[60px] flex justify-center items-center gap-1.5"
							>
								{isExecuting ? (
									<div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								) : (
									<>
										<span className="material-symbols-outlined text-[16px]">sync_alt</span>
										<span>SYNC ({selectedIds.size})</span>
									</>
								)}
							</button>
						)}
					</div>
				</div>
			</header>

			{isLoading ? (
				<div className="flex-1 flex flex-col items-center justify-center">
					<Loader />
					<p className="mt-4 text-gray-500 text-sm font-medium">Comparing schedules...</p>
				</div>
			) : hasNoChanges ? (
				<div className="flex-1 flex flex-col items-center justify-center text-gray-400">
					<div className="size-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
						<span className="material-symbols-outlined text-4xl text-gray-300">check</span>
					</div>
					<p className="text-lg font-bold text-gray-600">All Synced!</p>
					<p className="text-sm">No new changes found in ERP.</p>
					<button
						onClick={() => router.back()}
						className="mt-8 px-6 py-2.5 bg-background-dashboard border border-gray-200 text-gray-600 font-bold rounded-xl shadow-sm hover:bg-gray-50"
					>
						Back to Plan
					</button>
				</div>
			) : (
				<div className="flex-1 w-full flex flex-col">
					{/* Controls Bar */}
					<div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-[57px] z-40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						{/* Search Input */}
						<div className="relative flex-1 max-w-sm">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px]">
								search
							</span>
							<input
								type="text"
								placeholder="Search work orders, parts..."
								className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>

						{/* Tabs */}
						<div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-lg">
							<TabButton label="All" count={flatChanges.length} active={activeTab === "ALL"} onClick={() => setActiveTab("ALL")} />
							<TabButton label="Created" count={totalAdds} active={activeTab === "ADD"} onClick={() => setActiveTab("ADD")} />
							<TabButton label="Modified" count={totalUpdates} active={activeTab === "UPDATE"} onClick={() => setActiveTab("UPDATE")} />
							<TabButton label="Deleted" count={totalDeletes} active={activeTab === "DELETE"} onClick={() => setActiveTab("DELETE")} />
						</div>
					</div>

					{/* List Content */}
					<main className="flex-1 w-full p-4 space-y-3 pb-24">
						{filteredChanges.length === 0 ? (
							<div className="py-20 text-center">
								<p className="text-gray-400 text-sm italic">No matching changes found.</p>
							</div>
						) : (
							filteredChanges.map((item) => (
								<SyncCard key={item.id} item={item} checked={selectedIds.has(item.id)} onToggle={() => toggleId(item.id)} />
							))
						)}
					</main>
				</div>
			)}
		</div>
	);
}

// Subcomponents

function TabButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
	if (count === 0 && !active && label !== "All") return null;

	return (
		<button
			onClick={onClick}
			className={cn(
				"px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
				active ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50",
			)}
		>
			<span>{label}</span>
			{count > 0 && (
				<span
					className={cn(
						"px-1.5 py-0.5 rounded-full text-[9px] min-w-[16px]",
						active ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500",
					)}
				>
					{count}
				</span>
			)}
		</button>
	);
}

function SyncCard({ item, checked, onToggle }: { item: SyncChangeItem; checked: boolean; onToggle: () => void }) {
	const [expanded, setExpanded] = useState(false);

	const isUpdate = item.type === "UPDATE";
	const isAdd = item.type === "ADD";
	const isDelete = item.type === "DELETE";

	// Use exact same base classes as the Planning Page cards for border matching
	const baseCardClasses = "planning-card active:scale-[0.99] hover:border-card-border border-card-border";
	const selectedClasses = "bg-blue-50";

	return (
		<div
			className={cn(
				baseCardClasses,
				checked ? selectedClasses : "border-card-border bg-white",
				!checked && "opacity-70",
				"group relative overflow-hidden transition-all duration-200",
			)}
		>
			{/* Top Main Section */}
			{/* Top Main Section */}
			{/* Top Main Section */}
			<div className="flex items-stretch gap-3 p-0">
				{/* Content Column (Left) */}
				<div className="flex-1 flex flex-col gap-0.5 cursor-pointer min-w-0" onClick={onToggle}>
					<h3 className="list-title flex items-center gap-2">
						{item.title}
						{isAdd && (
							<span className="text-[9px] font-bold uppercase bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded tracking-wide border border-emerald-100">
								New
							</span>
						)}
						{isUpdate && (
							<span className="text-[9px] font-bold uppercase bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded tracking-wide border border-amber-100">
								Mod
							</span>
						)}
						{isDelete && (
							<span className="text-[9px] font-bold uppercase bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded tracking-wide border border-rose-100">
								Del
							</span>
						)}
					</h3>
					<p className="list-subtext">{item.subtitle}</p>

					{/* Accordion Content (Diff) - Now inside the flex-1 container to push flow properly */}
					{expanded && item.diff && (
						<div
							className="mt-3 pt-3 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200 cursor-default"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-start gap-2">
								<span className="material-symbols-outlined text-gray-400 text-[16px] mt-0.5">difference</span>
								<div className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-1.5 rounded border border-gray-200 w-full whitespace-pre-wrap">
									{item.diff}
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Controls Column (Right) */}
				<div className="flex flex-col items-center h-full min-w-[24px] py-0.5">
					{/* Checkbox */}
					<div className="cursor-pointer" onClick={onToggle}>
						<div
							className={cn(
								"size-4 rounded-full border-[1.5px] flex items-center justify-center transition-all",
								checked
									? isDelete
										? "border-destructive bg-destructive text-white"
										: "border-primary bg-primary text-white"
									: "border-gray-300 bg-white group-hover:border-gray-400",
							)}
						>
							{checked && <span className="material-symbols-outlined !text-[12px] font-bold">check</span>}
						</div>
					</div>

					{/* Expand Toggle for Diff */}
					{item.diff && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								setExpanded(!expanded);
							}}
							className="mt-auto size-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
						>
							<span className={cn("material-symbols-outlined text-lg transition-transform duration-200", expanded ? "rotate-180" : "")}>
								expand_more
							</span>
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
