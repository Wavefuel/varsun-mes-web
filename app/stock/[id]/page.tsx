"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import AssignmentDetailsCard, { type AssignmentFormData } from "@/components/AssignmentDetailsCard";
import { NumberCounter } from "@/components/ui/NumberCounter";
import { useData } from "@/context/DataContext";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import type { Order } from "@/lib/types";
import {
	createDeviceStateEventGroup,
	fetchDeviceList,
	readDeviceStateEventGroupsWithItemsByCluster,
	updateDeviceStateEventGroupItems,
	type DeviceSummary,
} from "@/utils/scripts";
import { combineISTDateAndTime, formatTimeToIST24 } from "@/utils/dateUtils";

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

function StockEntryForm() {
	const router = useRouter();
	const params = useParams();
	const searchParams = useSearchParams();

	const rawId = params?.id;
	const idString = Array.isArray(rawId) ? rawId[0] : rawId;
	const orderId = idString ? decodeURIComponent(idString) : "";

	const queryDeviceId = searchParams?.get("deviceId") ?? "";
	const queryDate = searchParams?.get("date") ?? "";

	const { addOrder, getOrderById, updateOrder, stockDevices, setStockDevices, stockOrders } = useData();

	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID ?? "";
	const lhtAccountId = process.env.NEXT_PUBLIC_LHT_ACCOUNT_ID ?? "";
	const lhtApplicationId = process.env.NEXT_PUBLIC_APPLICATION_ID ?? "";
	const lighthouseEnabled = Boolean(lhtClusterId && lhtAccountId && lhtApplicationId);

	// 1. Try finding in loaded stockOrders context first (Live Data)
	const cachedOrder = stockOrders?.find((o) => o.id === orderId || o.lhtGroupId === orderId);
	// 2. Fallback to local storage logic
	const localOrder = getOrderById(orderId);

	const orderFromContext = cachedOrder || localOrder;

	const [resolvedOrder, setResolvedOrder] = useState<Order | null>(null);
	const [devices, setDevices] = useState<DeviceSummary[]>(stockDevices);
	const [isLoading, setIsLoading] = useState(true);
	const [isError, setIsError] = useState(false);

	// Initialize itemCategory from context if available
	const [itemCategory, setItemCategory] = useState<string>(() => {
		if (orderFromContext?.status) {
			return orderFromContext.status.toUpperCase();
		}
		return "PLANNED";
	});
	// Initialize eventGroupId from context if available
	const [eventGroupId, setEventGroupId] = useState<string>(() => orderFromContext?.lhtGroupId ?? "");
	const [eventItemId, setEventItemId] = useState<string>("");
	const [groupRangeStart, setGroupRangeStart] = useState<string>("");
	const [groupRangeEnd, setGroupRangeEnd] = useState<string>("");

	const parseEst = (est: string) => {
		if (est.endsWith("h")) return { estTime: est.replace(/h$/, ""), estUnit: "hr" as const };
		return { estTime: est.replace(/m$/, ""), estUnit: "min" as const };
	};

	// Completion Form State
	const [actualOutput, setActualOutput] = useState(() => orderFromContext?.actualOutput || 0);
	const [toolChanges, setToolChanges] = useState(() => orderFromContext?.toolChanges || 0);
	const [rejects, setRejects] = useState(() => orderFromContext?.rejects || 0);
	const [actualStartTime, setActualStartTime] = useState(() => orderFromContext?.actualStartTime || orderFromContext?.startTime || "");
	const [actualEndTime, setActualEndTime] = useState(() => orderFromContext?.actualEndTime || orderFromContext?.endTime || "");
	const [remarks, setRemarks] = useState(() => orderFromContext?.remarks || "");
	const [isDetailsOpen, setIsDetailsOpen] = useState(false);

	const [formData, setFormData] = useState<AssignmentFormData>(() => {
		const o = orderFromContext;
		if (!o) {
			return {
				machine: "",
				operator: "",
				date: "",
				shift: "",
				startTime: "",
				endTime: "",
				code: "",
				partNumber: "",
				workOrderId: "",
				opNumber: 0,
				batch: 0,
				estTime: "",
				estUnit: "min",
			};
		}
		const { estTime, estUnit } = parseEst(o.estPart || "0m");
		return {
			machine: o.machine,
			operator: o.operator,
			date: o.date,
			shift: o.shift,
			startTime: o.startTime,
			endTime: o.endTime,
			code: o.code,
			partNumber: o.partNumber,
			workOrderId: (o as any).workOrder || o.id, // Fallback safely
			opNumber: o.opNumber,
			batch: o.batch,
			estTime,
			estUnit,
		};
	});

	const deviceLabel = (device?: DeviceSummary) => device?.deviceName || device?.serialNumber || device?.foreignId || device?.id || "Unknown Device";

	const toIsoDayRange = (dateStr: string) => {
		const base = new Date(dateStr);
		if (Number.isNaN(base.getTime())) return null;
		const start = new Date(base);
		start.setHours(0, 0, 0, 0);
		const end = new Date(base);
		end.setHours(23, 59, 59, 999);
		return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
	};

	const toTimeHHMM = (value?: string | null) => {
		return formatTimeToIST24(value);
	};

	// Build ISO datetime: preserves date from baseDate, updates time from HH:MM string (interpreted as IST)
	const buildSegmentDateTime = (baseDate: string, timeHHMM: string) => {
		return combineISTDateAndTime(baseDate, timeHHMM);
	};

	// Main data fetching effect (Devices + Assignment)
	useEffect(() => {
		if (!orderId) {
			toast.error("Invalid Order ID");
			router.push("/stock");
			return;
		}

		if (!lighthouseEnabled) {
			toast.error("Lighthouse not configured");
			router.push("/stock");
			return;
		}

		let cancelled = false;

		const loadData = async () => {
			if (!cachedOrder) setIsLoading(true);

			try {
				// 1. Fetch Devices (if not cached)
				let deviceList = devices;
				if (deviceList.length === 0) {
					deviceList = await fetchDeviceList({ clusterId: lhtClusterId });
					if (cancelled) return;
					setDevices(deviceList);
					setStockDevices(deviceList);
				}

				// 2. Optimization: If we found it in stockOrders context, use it directly
				// (This assumes stockOrders has fresh enough data)
				if (cachedOrder) {
					console.log("Using cached order from stockOrders:", cachedOrder.id);
					setResolvedOrder(cachedOrder);
					// Ensure local syncing for future
					addOrder(cachedOrder);

					// Populate form state from cached
					const built = cachedOrder;
					setActualOutput(built.actualOutput || 0);
					setToolChanges(built.toolChanges || 0);
					setRejects(built.rejects || 0);
					setRemarks(built.remarks || "");
					setActualStartTime(built.actualStartTime || built.startTime || "");
					setActualEndTime(built.actualEndTime || built.endTime || "");

					const { estTime: parsedEstTime, estUnit: parsedEstUnit } = parseEst(built.estPart || "0m");
					setFormData({
						machine: built.machine,
						operator: built.operator,
						date: built.date,
						shift: built.shift,
						startTime: built.startTime,
						endTime: built.endTime,
						code: built.code,
						partNumber: built.partNumber,
						workOrderId: (built as any).workOrder || built.id,
						opNumber: built.opNumber,
						batch: built.batch,
						estTime: parsedEstTime,
						estUnit: parsedEstUnit,
					});

					// IDs
					if (built.lhtGroupId) setEventGroupId(built.lhtGroupId);
					// For item ID, stockOrders might map lhtItemId or we assume group ID logic
					// StockPage mapping doesn't explicitly have lhtItemId, it maps items to rows
					// Actually StockPage maps: lhtGroupId: String(group?.id ?? workOrder)
					// But doesn't map 'lhtItemId'.
					// We might need to fetch anyway if lhtItemId or precise details are missing?
					// StockPage:
					// const mapped: Order[] = groups.flatMap(...)
					// It does NOT map lhtItemId.
					// SO WE MIGHT NEED TO FETCH ANYWAY if we need the ITEM ID for updates.
					// However, if we just need to VIEW, it's fine.
					// But this page is for COMPLETION (Update).
					// To update a Lighthouse item, we need its ID.

					// Checking if we can skip...
					// The update logic uses: eventItemId
					// stockOrders does not seem to put eventItemId into the Order type currently?
					// Let's check types.ts
				}

				// If we don't have the fully resolved IDs (specifically ITEM ID for Updates), we must fetch.
				// cachedOrder is type Order. Order interface doesn't have lhtItemId (it has lhtGroupId).
				// Assignment interface HAS lhtItemId.
				// StockPage maps to Order.

				// SO: We probably DO need to fetch to get the specific Item ID within the group if it's not in the Order type.
				// UNLESS we update Order type to include lhtItemId.

				// Let's stick to fetching for now to be safe, BUT prioritize ID lookup logic below.

				// 3. Sync logic from context if available
				if (orderFromContext) {
					const statusFromContext = orderFromContext.status?.toUpperCase();
					if (statusFromContext && statusFromContext !== itemCategory) {
						setItemCategory(statusFromContext);
					}
					if (orderFromContext.lhtGroupId && orderFromContext.lhtGroupId !== eventGroupId) {
						setEventGroupId(orderFromContext.lhtGroupId);
					}
				}

				// Fetch remote data to get IDs / refresh details
				const selectedDate = queryDate || orderFromContext?.date || new Date().toISOString().split("T")[0];
				const range = toIsoDayRange(selectedDate);
				if (!range) {
					throw new Error("Invalid date");
				}

				const groupsUnknown = await readDeviceStateEventGroupsWithItemsByCluster({
					clusterId: lhtClusterId,
					applicationId: lhtApplicationId,
					account: { id: lhtAccountId },
					query: { rangeStart: range.rangeStart, rangeEnd: range.rangeEnd },
					deviceId: queryDeviceId && queryDeviceId !== "ALL" ? queryDeviceId : undefined,
				});

				const groups: ApiEventGroup[] = Array.isArray(groupsUnknown) ? (groupsUnknown as ApiEventGroup[]) : [];

				// Find all matching groups (by ID or Work Order)
				const matchingGroups = groups.filter((g) => {
					if (String(g?.id ?? "") === orderId) return true;
					return (Array.isArray(g?.Items) ? g.Items : []).some((entry) => {
						const md = entry?.metadata as Record<string, unknown> | undefined;
						return String(md?.workOrder ?? "") === orderId;
					});
				});

				// If multiple found, prefer the one that is COMPLETED
				const foundGroup =
					matchingGroups.find((g) => {
						const item = Array.isArray(g.Items) ? g.Items[0] : null;
						return String(item?.category || "").toUpperCase() === "COMPLETED";
					}) ??
					matchingGroups[0] ??
					null;

				if (!foundGroup) {
					toast.error("Order not found");
					router.push("/stock");
					return;
				}

				const deviceId = String(foundGroup.deviceId ?? "");
				const foundDevice = deviceList.find((d) => d.id === deviceId);
				const item = Array.isArray(foundGroup.Items) ? foundGroup.Items[0] : null;
				const metadata = item?.metadata ?? {};
				const category = typeof item?.category === "string" ? String(item.category).toUpperCase() : "";
				const status: Order["status"] = category === "COMPLETED" ? "COMPLETED" : "PLANNED";

				const built: Order = {
					id: orderId,
					partNumber: String(metadata.partNumber ?? ""),
					machine: deviceLabel(foundDevice) || deviceId || "Unknown Device",
					operator: String(metadata.operatorCode ?? ""),
					date: selectedDate,
					shift: "Day Shift (S1)",
					startTime: toTimeHHMM(item?.segmentStart ?? null) || "",
					endTime: toTimeHHMM(item?.segmentEnd ?? null) || "",
					code: String(metadata.operatorCode ?? ""),
					opNumber: 0,
					batch: Number(metadata.opBatchQty ?? 0),
					estPart: String(metadata.estPartAdd ?? ""),
					target: Number(metadata.opBatchQty ?? 1),
					status,
					lhtDeviceId: deviceId || undefined,
					lhtGroupId: String(foundGroup.id ?? orderId),
					actualOutput: Number(metadata.actualOutput ?? 0),
					toolChanges: Number(metadata.toolChanges ?? 0),
					rejects: Number(metadata.rejects ?? 0),
					remarks: String(metadata.remarks ?? ""),
					actualStartTime: String(metadata.actualStartTime ?? ""),
					actualEndTime: String(metadata.actualEndTime ?? ""),
					// Add workOrder to the built object (cast to any or extend type locally if needed by consumers)
					workOrder: String(metadata.workOrder ?? ""),
				} as Order & { workOrder?: string };

				if (cancelled) return;
				setResolvedOrder(built);
				setEventItemId(String(item?.id ?? ""));
				setEventGroupId(String(foundGroup.id ?? ""));
				setItemCategory(category || "PLANNED");
				setGroupRangeStart(typeof foundGroup.rangeStart === "string" ? foundGroup.rangeStart : "");
				setGroupRangeEnd(typeof foundGroup.rangeEnd === "string" ? foundGroup.rangeEnd : "");

				// Seed local storage for future
				addOrder(built);

				setActualOutput(built.actualOutput || 0);
				setToolChanges(built.toolChanges || 0);
				setRejects(built.rejects || 0);
				setRemarks(built.remarks || "");
				// Auto-populate actual times from segment times if not already set
				setActualStartTime(built.actualStartTime || built.startTime || "");
				setActualEndTime(built.actualEndTime || built.endTime || "");

				const { estTime: parsedEstTime, estUnit: parsedEstUnit } = parseEst(built.estPart || "0m");
				setFormData({
					machine: built.machine,
					operator: built.operator,
					date: built.date,
					shift: built.shift,
					startTime: built.startTime,
					endTime: built.endTime,
					code: built.code,
					partNumber: built.partNumber,
					workOrderId: built.id,
					opNumber: built.opNumber,
					batch: built.batch,
					estTime: parsedEstTime,
					estUnit: parsedEstUnit,
				});
			} catch (e) {
				console.error(e);
				setIsError(true);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		loadData();

		return () => {
			cancelled = true;
		};
	}, [
		// Only re-run if these specific IDs/flags change.
		// Ignoring function identities (addOrder, router) to prevent double-fetch.
		orderId,
		lighthouseEnabled,
		lhtClusterId,
		lhtAccountId,
		lhtApplicationId,
		queryDeviceId,
		queryDate,
		// eslint-disable-next-line react-hooks/exhaustive-deps
	]);

	const order = orderFromContext ?? resolvedOrder;
	const loading = Boolean(orderId && lighthouseEnabled && !orderFromContext && !resolvedOrder);

	if (loading) return null;
	if (!order) return null;

	// Fallback to minimal data if order is missing but we have error (shouldn't happen due to loading check, but safe)
	const displayPN = order?.partNumber || "Unknown";
	// Prefer workOrder if available, otherwise fallback to ID (which might be Group ID)
	const displayID = (order as any).workOrder || order?.id || orderId;
	const displayDate = order ? new Date(order.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
	const target = order.target || 1;
	const efficiency = Math.round((actualOutput / target) * 100);
	const visualEfficiency = Math.min(efficiency, 100);
	const progressPercent = Math.min((actualOutput / target) * 100, 100);

	const handleSave = async () => {
		if (!orderId) return;

		if (lighthouseEnabled && order.lhtDeviceId) {
			try {
				// Build segment times preserving date from group range, updating time portion
				const baseDate = groupRangeStart || order.date;
				let segmentStart = buildSegmentDateTime(baseDate, actualStartTime);
				let segmentEnd = buildSegmentDateTime(baseDate, actualEndTime);

				// Handle overnight logic (if End < Start, assume next day)
				if (segmentStart && segmentEnd && new Date(segmentEnd) < new Date(segmentStart)) {
					const end = new Date(segmentEnd);
					end.setDate(end.getDate() + 1);
					segmentEnd = end.toISOString();
				}

				// Validate actual times against group range (similar to create form validation)
				if (groupRangeStart && groupRangeEnd && segmentStart && segmentEnd) {
					const rangeStartMs = new Date(groupRangeStart).getTime();
					const rangeEndMs = new Date(groupRangeEnd).getTime();
					const segStartMs = new Date(segmentStart).getTime();
					const segEndMs = new Date(segmentEnd).getTime();

					if (
						!Number.isFinite(rangeStartMs) ||
						!Number.isFinite(rangeEndMs) ||
						!Number.isFinite(segStartMs) ||
						!Number.isFinite(segEndMs) ||
						segStartMs < rangeStartMs ||
						segEndMs > rangeEndMs
					) {
						toast.error("Actual times must be within the shift window");
						return;
					}
				}

				// Build range from group or from order date
				const range = groupRangeStart && groupRangeEnd ? { rangeStart: groupRangeStart, rangeEnd: groupRangeEnd } : toIsoDayRange(order.date);

				// For new groups (PLANNED), ensure range covers the segment end
				if (itemCategory === "PLANNED" && range && segmentEnd && new Date(segmentEnd) > new Date(range.rangeEnd)) {
					range.rangeEnd = segmentEnd;
				}

				console.log("[DEBUG] handleSave - itemCategory:", itemCategory, "eventGroupId:", eventGroupId, "eventItemId:", eventItemId);

				if (itemCategory === "PLANNED") {
					// PLANNED: Create a NEW group with category COMPLETED
					const createdGroup = await createDeviceStateEventGroup({
						deviceId: order.lhtDeviceId,
						clusterId: lhtClusterId,
						applicationId: lhtApplicationId,
						account: { id: lhtAccountId },
						body: {
							rangeStart: range?.rangeStart,
							rangeEnd: range?.rangeEnd,
							title: `COMPLETED-${order.date}`,
							items: [
								{
									segmentStart: segmentStart || actualStartTime,
									segmentEnd: segmentEnd || actualEndTime,
									category: "COMPLETED",
									operatorCode: order.code,
									partNumber: order.partNumber,
									workOrder: order.id,
									opBatchQty: order.batch,
									estPartAdd: order.estPart,
									metadata: {
										workOrder: order.id,
										partNumber: order.partNumber,
										operatorCode: order.code,
										opBatchQty: order.batch,
										estPartAdd: order.estPart,
										actualOutput,
										toolChanges,
										rejects,
										actualStartTime,
										actualEndTime,
										remarks,
									},
								},
							],
						},
					});

					// Update state so subsequent saves update the existing COMPLETED group
					if (createdGroup) {
						const newGroupId = String(createdGroup.id ?? "");
						const newItemId = Array.isArray(createdGroup.Items) && createdGroup.Items[0] ? String(createdGroup.Items[0].id ?? "") : "";
						setEventGroupId(newGroupId);
						setEventItemId(newItemId);
						setItemCategory("COMPLETED");
					}
				} else {
					// COMPLETED: Update existing item in the existing group
					// Use eventGroupId (the actual group ID) instead of order.lhtGroupId (which is the work order ID)
					const groupIdToUse = eventGroupId || order.lhtGroupId!;
					await updateDeviceStateEventGroupItems({
						deviceId: order.lhtDeviceId,
						clusterId: lhtClusterId,
						groupId: groupIdToUse,
						applicationId: lhtApplicationId,
						account: { id: lhtAccountId },
						items: [
							{
								id: eventItemId,
								segmentStart,
								segmentEnd,
								category: "COMPLETED",
								operatorCode: order.code,
								partNumber: order.partNumber,
								workOrder: order.id,
								opBatchQty: order.batch,
								estPartAdd: order.estPart,
								metadata: {
									workOrder: order.id,
									partNumber: order.partNumber,
									operatorCode: order.code,
									opBatchQty: order.batch,
									estPartAdd: order.estPart,
									actualOutput,
									toolChanges,
									rejects,
									actualStartTime,
									actualEndTime,
									remarks,
								},
							},
						],
					});
				}
			} catch (e) {
				console.error(e);
				toast.error("Failed to submit completion to Lighthouse");
				return;
			}
		}

		updateOrder(orderId, {
			status: "COMPLETED",
			actualOutput,
			toolChanges,
			rejects,
			actualStartTime,
			actualEndTime,
			remarks,
		});
		toast.success("Order completed successfully");
		router.push("/stock");
	};

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard font-display relative">
			{isLoading && (
				<div className="absolute inset-0 z-[60] bg-white/50 backdrop-blur-sm flex items-center justify-center">
					<Loader />
				</div>
			)}
			{/* Header */}
			<header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-(--header-height) px-4 py-2">
				<div className="flex items-center justify-between h-full">
					<div className="flex flex-col">
						<h2 className="header-title">Complete Order</h2>
						<p className="header-subtitle mt-0.5 uppercase block">Inventory</p>
					</div>
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
									onClick={handleSave}
									className="bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform"
								>
									SAVE
								</button>
							</>
						)}
					</div>
				</div>
			</header>

			{isError ? (
				<div className="flex-1 flex flex-col items-center justify-center -mt-20">
					<EmptyState
						icon="cloud_off"
						title="Connection Failed"
						description={
							<span>
								Unable to retrieve order details. <br />
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
				<main className="!p-4 !space-y-3 !pb-24">
					{/* 1. Key Info - Context Aware (Standard Card) */}
					<section className="grid grid-cols-3 !gap-2">
						<div className="bg-white !rounded-lg border border-gray-100 shadow-sm !px-3 !py-1.5 flex flex-col justify-center items-start min-h-[52px]">
							<p className="!text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Part Number</p>
							<p className="text-xs font-bold text-gray-800 leading-tight break-all">{displayPN}</p>
						</div>
						<div className="bg-white !rounded-lg border border-gray-100 shadow-sm !px-3 !py-1.5 flex flex-col justify-center items-start min-h-[52px]">
							<p className="!text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Order ID</p>
							<p className="text-xs font-bold text-gray-800 leading-tight break-all">{displayID}</p>
						</div>
						<div className="bg-white !rounded-lg border border-gray-100 shadow-sm !px-3 !py-1.5 flex flex-col justify-center items-start min-h-[52px]">
							<p className="!text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Date</p>
							<p className="text-xs font-bold text-gray-800 leading-tight">{displayDate}</p>
						</div>
					</section>

					{/* 2. Combined Production Efficiency & Input */}
					<section className="bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden">
						<div className="bg-gray-50 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center">
							<h3 className="font-bold text-sm uppercase tracking-wider text-primary">Production Input</h3>
							<span className="material-symbols-outlined text-gray-400 !text-lg">input</span>
						</div>

						<div className="!p-4 !space-y-2">
							{/* Efficiency Header Section */}
							<div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
								<div className="flex items-center justify-between mb-3">
									<div>
										<div className="flex items-baseline gap-2">
											<span className="text-2xl font-bold text-gray-800 tracking-tight">{efficiency}%</span>
											<div className="flex items-center gap-0.5 text-[9px] font-bold text-red-500">
												<span className="material-symbols-outlined !text-[10px]">trending_down</span>
												20u
											</div>
										</div>
										<p className="!text-[9px] font-medium text-gray-500 mt-0.5 uppercase tracking-wide">
											Based on EST {order.estPart}
										</p>
									</div>

									{/* Radial Progress */}
									<div className="relative size-10 flex-shrink-0">
										<div
											className="radial-progress absolute inset-0 rounded-full text-primary"
											style={{ "--value": visualEfficiency, "--size": "2.5rem", "--thickness": "3px" } as React.CSSProperties}
										></div>
										<div className="absolute inset-0 flex items-center justify-center">
											<span className="material-symbols-outlined text-primary !text-lg">factory</span>
										</div>
									</div>
								</div>

								<div>
									<div className="flex justify-between !text-[9px] font-medium uppercase tracking-wider mb-1">
										<span className="text-gray-500">Progress</span>
										<span className="text-gray-800">
											{actualOutput} / {order.target}
										</span>
									</div>
									<div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
										<div
											className="h-full bg-primary rounded-full transition-all duration-300"
											style={{ width: `${progressPercent}%` }}
										></div>
									</div>
								</div>
							</div>

							{/* Actual Shift Timings */}
							<div className="space-y-1.5">
								<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Timings</label>
								<div className="flex !gap-2 bg-primary/5 !p-3 rounded-lg border border-primary/10 transition-colors">
									<div className="flex-1 flex flex-col justify-center">
										<p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">Actual Start</p>
										<input
											type="time"
											min={order.shift === "Day Shift (S1)" ? "08:00" : undefined}
											max={order.shift === "Day Shift (S1)" ? "20:00" : undefined}
											value={actualStartTime}
											onChange={(e) => setActualStartTime(e.target.value)}
											className="w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto"
										/>
									</div>
									<div className="w-px bg-primary/20"></div>
									<div className="flex-1 flex flex-col justify-center">
										<p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">Actual End</p>
										<input
											type="time"
											min={order.shift === "Day Shift (S1)" ? "08:00" : undefined}
											max={order.shift === "Day Shift (S1)" ? "20:00" : undefined}
											value={actualEndTime}
											onChange={(e) => setActualEndTime(e.target.value)}
											className="w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto"
										/>
									</div>
								</div>
							</div>

							{/* Counters Grid - 3 Columns matching 'Op/Batch/Est' density */}
							<div className="grid grid-cols-3 !gap-2">
								<NumberCounter label="Output (Good)" value={actualOutput} onChange={setActualOutput} />
								<NumberCounter label="Tool Changes" value={toolChanges} onChange={setToolChanges} />
								<NumberCounter label="Rejects" value={rejects} onChange={setRejects} inputClassName="text-red-500" />
							</div>

							{/* Remarks */}
							<div className="space-y-1.5">
								<label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">
									Remarks <span className="font-normal text-gray-400 normal-case">(optional)</span>
								</label>
								<textarea
									className="w-full bg-gray-50 border border-gray-200 !rounded-lg !p-3 !text-xs font-medium text-gray-800 focus:ring-primary focus:border-primary resize-none h-20 placeholder:text-gray-400"
									placeholder="Enter production notes..."
									value={remarks}
									onChange={(e) => setRemarks(e.target.value)}
								></textarea>
							</div>
						</div>
					</section>

					{/* 4. Planned Order Details (Collapsible) - Context Aware */}
					<div className="bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden">
						<button
							onClick={() => setIsDetailsOpen(!isDetailsOpen)}
							className="w-full bg-gray-50/80 !px-4 !py-3 border-b border-gray-100 flex justify-between items-center active:bg-gray-50 transition-colors"
						>
							<h3 className="font-bold text-sm uppercase tracking-wider text-primary">Planned Order Details</h3>
							<span
								className={`material-symbols-outlined text-gray-400 !text-lg transition-transform duration-300 ${isDetailsOpen ? "rotate-180" : ""}`}
							>
								expand_more
							</span>
						</button>
						{isDetailsOpen && (
							<div className="animate-in slide-in-from-top-2 duration-200 bg-white">
								<AssignmentDetailsCard
									title="Planned Details"
									icon="assignment"
									data={formData}
									onChange={() => {}}
									readOnly={true}
									hideHeader={true}
									devices={devices}
									selectedDeviceId={order?.lhtDeviceId}
								/>
							</div>
						)}
					</div>
				</main>
			)}
		</div>
	);
}

export default function StockCreatePage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<StockEntryForm />
		</Suspense>
	);
}
