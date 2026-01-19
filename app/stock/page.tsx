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
	const { orders, currentDate, stockOrders, setStockOrders, stockDevices, setStockDevices, stockDataDate, setStockDataDate } = useData();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState<"All" | "Planned" | "Completed">("All");
	const [showFilters, setShowFilters] = useState(false);

	// Local loading state just for the initial fetch trigger visual
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);

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
		if (stockDevices.length) return;
		fetchDeviceList({ clusterId: lhtClusterId })
			.then((result) => setStockDevices(result))
			.catch((error) => console.error(error));
	}, [stockDevices.length, lighthouseEnabled, lhtClusterId, setStockDevices]);

	// Reset error when date changes
	useEffect(() => {
		setIsError(false);
	}, [currentDate]);

	useEffect(() => {
		if (!lighthouseEnabled || !lhtClusterId || !lhtAccountId) return;

		// Wait for devices to be loaded before fetching assignments to avoid ID flash
		if (lighthouseEnabled && !stockDevices.length) {
			return;
		}

		// Check if data is already loaded for this date
		if (stockDataDate === currentDate && stockOrders) {
			return;
		}

		if (isError) return;

		setIsLoading(true);

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
					const rangeStart = typeof group?.rangeStart === "string" ? group.rangeStart : null;
					const groupLocalDate = rangeStart ? toLocalYYYYMMDD(rangeStart) : currentDate;
					if (groupLocalDate !== currentDate) return [];

					const deviceId = typeof group?.deviceId === "string" ? group.deviceId : "";
					const machineName = (() => {
						if (!deviceId) return "Unknown Device";
						const device = stockDevices.find((d) => d.id === deviceId);
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
						const startTime = formatTimeValue(item?.segmentStart ?? undefined);
						const endTime = formatTimeValue(item?.segmentEnd ?? undefined);
						const category = typeof item?.category === "string" ? String(item.category).toUpperCase() : "";
						const status: Order["status"] = category === "COMPLETED" ? "COMPLETED" : "PLANNED";
						const groupId = String(group?.id ?? workOrder);

						return [
							{
								id: groupId,
								workOrder,
								partNumber: String(metadata.partNumber ?? ""),
								machine: machineName,
								operator: String(metadata.operatorCode ?? ""),
								date: currentDate,
								shift: "Day Shift (S1)",
								startTime,
								endTime,
								code: String(metadata.operatorCode ?? ""),
								opNumber: 0,
								batch,
								estPart,
								target: batch,
								status,
								lhtDeviceId: deviceId || undefined,
								lhtGroupId: groupId,
							},
						];
					});
				});
				setStockOrders(mapped);
				setStockDataDate(currentDate);
			})
			.catch((error) => {
				console.error(error);
				setStockOrders([]);
				setIsError(true);
			})
			.finally(() => setIsLoading(false));
	}, [
		currentDate,
		stockDevices,
		lighthouseEnabled,
		lhtAccountId,
		lhtApplicationId,
		lhtClusterId,
		stockOrders,
		setStockOrders,
		setStockDataDate,
		stockDataDate,
		isError,
	]);

	const sourceOrders = useMemo(() => (lighthouseEnabled ? (stockOrders ?? []) : orders), [lighthouseEnabled, orders, stockOrders]);

	// Filter Logic
	const filteredOrders = sourceOrders.filter((order) => {
		if (order.date !== currentDate) return false;
		const displayWorkOrder = (order as Order & { workOrder?: string }).workOrder || order.id;

		const matchesSearch =
			order.machine.toLowerCase().includes(searchQuery.toLowerCase()) ||
			order.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
			order.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
			displayWorkOrder.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesStatus = filterStatus === "All" || order.status === filterStatus.toUpperCase();

		return matchesSearch && matchesStatus;
	});

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard pb-24">
			<AppHeader title="Stock & Inventory" subtitle="Material Management" showDateNavigator={true} />

			{/* Sticky Controls Container */}
			<div className="sticky top-(--header-height-expanded) z-20 bg-background-dashboard pb-3 px-4">
				{/* Search & Filter Row */}
				<SearchFilterBar
					className="mt-3"
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					placeholder="Search stock..."
					showFilters={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
				/>

				{/* Filter Panel */}
				{showFilters && (
					<div className="mt-3 animate-in slide-in-from-top-1 fade-in duration-200">
						<div className="flex gap-2 overflow-x-auto scrollbar-none">
							{(["All", "Planned", "Completed"] as const).map((status) => (
								<button
									key={status}
									onClick={() => setFilterStatus(status)}
									className={cn(
										"h-9 px-4 rounded-lg text-xs font-bold transition-all duration-200 uppercase tracking-wide border",
										filterStatus === status
											? "bg-primary border-primary text-white shadow-md shadow-primary/20"
											: "bg-white border-gray-200 text-gray-500 hover:text-primary hover:border-primary/30 hover:bg-gray-50",
									)}
								>
									{status}
								</button>
							))}
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
				) : isLoading || stockDataDate !== currentDate || (lighthouseEnabled && !stockDevices.length) ? (
					<div className="flex-1 flex flex-col justify-center select-none min-h-[50vh]">
						<Loader />
					</div>
				) : (
					<>
						{filteredOrders.map((order) => {
							const displayWorkOrder = (order as Order & { workOrder?: string }).workOrder || order.id;
							const routeId = (order as Order & { workOrder?: string }).workOrder || order.id;
							return (
								<Link
									key={order.id}
									href={`/stock/${encodeURIComponent(routeId)}`}
									className="list-card card-shadow active:scale-[0.99] transition-transform"
								>
									<div className="flex justify-between items-start gap-4">
										{/* Left Column */}
										<div className="flex flex-col gap-0.5 flex-1">
											{/* Header: Machine + Status */}
											<div className="flex items-center gap-2">
												<h3 className="list-title">{order.machine}</h3>
												<div
													className={cn(
														"size-2 rounded-full",
														order.status === "PLANNED"
															? "bg-status-planned"
															: order.status === "COMPLETED"
																? "bg-status-completed"
																: "bg-status-default",
													)}
												></div>
											</div>

											{/* Part Number • WO */}
											<p className="list-subtext">
												{order.partNumber} • {displayWorkOrder}
											</p>

											{/* Operator */}
											<p className="list-subtext">{order.operator}</p>
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
