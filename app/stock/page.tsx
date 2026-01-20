"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import AppHeader from "@/components/AppHeader";
import SearchFilterBar from "@/components/SearchFilterBar";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import Select from "@/components/ui/Select";
import { useData } from "@/context/DataContext";
import type { Order } from "@/lib/types";
import { fetchDeviceList, readDeviceStateEventGroupsWithItemsByCluster, type DeviceSummary } from "@/utils/scripts";
import { formatTimeToIST, getISTDate } from "@/utils/dateUtils";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export default function StockPage() {
	const {
		orders,
		currentDate,
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

	// Local loading state just for the initial fetch trigger visual
	const [isLoading, setIsLoading] = useState(false);
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
		const d = getISTDate(iso);
		if (!d) return "";
		// Return YYYY-MM-DD based on IST date
		return d.toISOString().split("T")[0];
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

	useEffect(() => {
		if (!lighthouseEnabled || !lhtClusterId) return;
		// If we already have devices in context, don't refetch
		if (globalDevices.length) return;
		if (deviceFetchRef.current) return;
		deviceFetchRef.current = true;

		fetchDeviceList({ clusterId: lhtClusterId })
			.then((result) => setGlobalDevices(result))
			.catch((error) => {
				console.error(error);
				setIsError(true);
			});
	}, [globalDevices.length, lighthouseEnabled, lhtClusterId, setGlobalDevices]);

	// Reset error when date changes
	useEffect(() => {
		setIsError(false);
	}, [currentDate]);

	useEffect(() => {
		if (!lighthouseEnabled || !lhtClusterId || !lhtAccountId) return;

		// Wait for devices to be loaded before fetching assignments to avoid ID flash
		if (lighthouseEnabled && !globalDevices.length) {
			return;
		}

		// Check if data is already loaded for this date and shift
		if (globalDataDate === `${currentDate}:${currentShift}` && globalAssignments) {
			return;
		}

		if (isError) return;

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

		readDeviceStateEventGroupsWithItemsByCluster({
			clusterId: lhtClusterId,
			applicationId: lhtApplicationId,
			account: { id: lhtAccountId },
			query: { rangeStart: start, rangeEnd: end },
		})
			.then((groupsUnknown: unknown) => {
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
					Items?: ApiEventItem[] | null;
				};

				const groups: ApiEventGroup[] = Array.isArray(groupsUnknown) ? (groupsUnknown as ApiEventGroup[]) : [];
				const mapped: Order[] = groups.flatMap((group) => {
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
						const startTime = formatTimeValue(item?.segmentStart ?? undefined);
						const endTime = formatTimeValue(item?.segmentEnd ?? undefined);
						const category = typeof item?.category === "string" ? String(item.category).toUpperCase() : "";
						const status: Order["status"] = category === "ACTUAL_OUTPUT" ? "ACTUAL_OUTPUT" : "PLANNED_OUTPUT";
						const groupId = String(group?.id ?? workOrder);
						const itemId = String(item?.id ?? "");

						const rawOp = metadata.opNumber ?? "0";
						const opNumber = Array.isArray(rawOp) ? rawOp.map(String) : [String(rawOp)];

						return [
							{
								id: groupId,
								workOrder,
								partNumber: String(metadata.partNumber ?? ""),
								machine: machineName,
								operator: String(metadata.operatorCode ?? ""),
								date: currentDate,
								shift: groupShift,
								startTime,
								endTime,
								code: String(metadata.operatorCode ?? ""),
								opNumber,
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
				setGlobalAssignments(mapped as any); // Casting since Order vs Assignment might have slight diffs but they are compatible
				setGlobalDataDate(`${currentDate}:${currentShift}`);
			})
			.catch((error) => {
				console.error(error);
				setGlobalAssignments([]);
				setIsError(true);
			})
			.finally(() => setIsLoading(false));
	}, [
		currentDate,
		globalDevices,
		lighthouseEnabled,
		lhtAccountId,
		lhtApplicationId,
		lhtClusterId,
		globalAssignments,
		setGlobalAssignments,
		setGlobalDataDate,
		globalDataDate,
		isError,
		currentShift,
	]);

	const sourceOrders = useMemo(
		() => (lighthouseEnabled ? ((globalAssignments as any as Order[]) ?? []) : orders),
		[lighthouseEnabled, orders, globalAssignments],
	);

	const machineOptions = useMemo(() => {
		const machines = Array.from(new Set(sourceOrders.map((o) => o.machine)))
			.filter(Boolean)
			.sort();
		return ["All", ...machines];
	}, [sourceOrders]);

	const operatorOptions = useMemo(() => {
		const operators = Array.from(new Set(sourceOrders.map((o) => o.operator)))
			.filter(Boolean)
			.sort();
		return ["All", ...operators];
	}, [sourceOrders]);

	// Filter Logic
	const filteredOrders = sourceOrders.filter((order) => {
		// API already filters by shift range, but we keep it for consistency
		const displayWorkOrder = (order as Order & { workOrder?: string }).workOrder || order.id;

		const matchesSearch =
			order.machine.toLowerCase().includes(searchQuery.toLowerCase()) ||
			order.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
			order.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
			displayWorkOrder.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesOperator = filterOperator === "All" || order.operator === filterOperator;
		const matchesMachine = filterMachine === "All" || order.machine === filterMachine;

		return matchesSearch && matchesOperator && matchesMachine;
	});

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard pb-24">
			<AppHeader title="Stock & Inventory" subtitle="Material Management" showDateNavigator={true} />

			{/* Sticky Controls Container */}
			<div className="sticky top-(--header-height-expanded) z-20 bg-background-dashboard pb-2 px-4">
				{/* Search & Filter Row */}
				<SearchFilterBar
					className="mt-2"
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					placeholder="Search stock..."
					showFilters={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
				/>

				{/* Filter Panel */}
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
									className="w-full h-8 bg-white border-gray-200 shadow-sm text-xs"
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
									className="w-full h-8 bg-white border-gray-200 shadow-sm text-xs"
								/>
							</div>
						</div>
					</div>
				)}
			</div>

			<main className="px-4 space-y-2 flex-1 flex flex-col">
				{isError ? (
					<div className="flex-1 flex flex-col items-center justify-center -mt-20">
						<EmptyState
							icon="cloud_off"
							title="Connection Failed"
							description={
								<span>
									Unable to retrieve stock data. <br />
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
					<div className="flex-1 flex flex-col justify-center select-none min-h-[50vh]">
						<Loader />
					</div>
				) : (
					<>
						{filteredOrders.map((order) => {
							const displayWorkOrder = (order as Order & { workOrder?: string }).workOrder || order.id;
							const routeId = order.id;
							return (
								<Link
									key={order.id}
									href={`/stock/${encodeURIComponent(routeId)}`}
									className="list-card card-shadow active:scale-[0.99] transition-transform"
								>
									<div className="flex justify-between items-start gap-4">
										{/* Left Column */}
										<div className="flex flex-col gap-0.5 flex-1">
											<h3 className="list-title">
												{displayWorkOrder || "N/A"} • {order.code || "N/A"}
												<span
													className={cn(
														"inline-block ml-2 size-2 rounded-full mb-0.5",
														order.status === "PLANNED_OUTPUT"
															? "bg-status-planned"
															: order.status === "ACTUAL_OUTPUT"
																? "bg-status-completed"
																: "bg-status-default",
													)}
												/>
											</h3>

											<p className="list-subtext">
												{order.partNumber || "N/A"} • {order.operator || "N/A"}
											</p>
											<p className="list-subtext">{order.machine || "N/A"}</p>
										</div>

										{/* Right Column */}
										<div className="list-metric-column">
											{/* Shift Badge */}
											<span className="list-tag text-primary bg-primary/10">
												{order.startTime} - {order.endTime}
											</span>
										</div>
									</div>
								</Link>
							);
						})}

						{/* Empty State */}
						{filteredOrders.length === 0 && (
							<div className="flex-1 flex flex-col items-center justify-center -mt-20">
								<EmptyState
									icon="inventory_2"
									title="No Stock Found"
									description={
										<span>
											No stock items found for <br />
											<span className="text-primary font-bold mt-1 block">{formatDateForDisplay(currentDate)}</span>
										</span>
									}
								/>
							</div>
						)}
					</>
				)}
			</main>
		</div>
	);
}
