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
import { cn } from "@/lib/utils";
import CustomDatePicker from "@/components/CustomDatePicker";
import { format, parse } from "date-fns";
import { getShiftFromDisplayName, buildUtcRangeFromIstDate as buildUtcRangeUtil, SHIFT_CONFIG } from "@/utils/shiftUtils";

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

	const { addOrder, getOrderById, updateOrder, globalDevices, setGlobalDevices, globalAssignments, setGlobalAssignments, currentShift } = useData();

	const lighthouseEnabled = true; // Boolean(lhtClusterId && lhtAccountId && lhtApplicationId);

	// 1. Try finding in loaded globalAssignments context first (Live Data)
	const cachedOrder = globalAssignments?.find((o) => o.id === orderId || o.lhtGroupId === orderId);
	// 2. Fallback to local storage logic
	const localOrder = getOrderById(orderId);

	const orderFromContext = cachedOrder || localOrder;

	const [resolvedOrder, setResolvedOrder] = useState<Order | null>(null);
	const [devices, setDevices] = useState<DeviceSummary[]>(globalDevices);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isError, setIsError] = useState(false);

	// Initialize itemCategory from context if available
	const [itemCategory, setItemCategory] = useState<string>(() => {
		if (orderFromContext?.status) {
			return orderFromContext.status.toUpperCase();
		}
		return "PLANNED_OUTPUT";
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
	const [actualOutput, setActualOutput] = useState(() => {
		if (orderFromContext?.status === "ACTUAL_OUTPUT") {
			return orderFromContext.actualOutput ?? 0;
		}
		return orderFromContext?.target ?? orderFromContext?.batch ?? 0;
	});
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
				opNumber: [],
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
			workOrderId: o.workOrder || "N/A", // Fallback safely
			opNumber: o.opNumber,
			batch: o.batch,
			estTime,
			estUnit,
		};
	});

	const deviceLabel = (device?: DeviceSummary) => device?.deviceName || device?.serialNumber || device?.foreignId || device?.id || "Unknown Device";

	const toIsoShiftRange = (dateStr: string, shift: string) => {
		// Use centralized utility
		const shiftType = getShiftFromDisplayName(shift) || "Day";
		const { fromDateUTC, toDateUTC } = buildUtcRangeUtil(dateStr, shiftType);
		return {
			rangeStart: fromDateUTC.toISOString(),
			rangeEnd: toDateUTC.toISOString(),
		};
	};

	const toTimeHHMM = (value?: string | null) => {
		return formatTimeToIST24(value);
	};

	// Build ISO datetime: preserves date from baseDate, updates time from HH:MM string (interpreted as IST)
	const buildSegmentDateTime = (baseDate: string, timeHHMM: string) => {
		return combineISTDateAndTime(baseDate, timeHHMM);
	};

	// Helper function to format time for display
	const formatTimeDisplay = (time24: string) => {
		if (!time24) return "";
		try {
			const date = parse(time24, "HH:mm", new Date());
			return format(date, "hh:mm aa");
		} catch (e) {
			return time24;
		}
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
					deviceList = await fetchDeviceList({});
					if (cancelled) return;
					setDevices(deviceList);
					setGlobalDevices(deviceList);
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
						workOrderId: built.workOrder || "N/A",
						opNumber: built.opNumber,
						batch: built.batch,
						estTime: parsedEstTime,
						estUnit: parsedEstUnit,
					});

					// IDs
					if (built.lhtGroupId) setEventGroupId(built.lhtGroupId);
				}

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
				const shiftToUse = orderFromContext?.shift || currentShift;
				const range = toIsoShiftRange(selectedDate, shiftToUse);
				if (!range) {
					throw new Error("Invalid date");
				}

				const groupsUnknown = await readDeviceStateEventGroupsWithItemsByCluster({
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
						return String(item?.category || "").toUpperCase() === "ACTUAL_OUTPUT";
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
				const status: Order["status"] = category === "ACTUAL_OUTPUT" ? "ACTUAL_OUTPUT" : "PLANNED_OUTPUT";

				// Handle parsing opNumber (could be number or string or array)
				const rawOp = metadata.opNumber ?? "0";
				const opNumber = Array.isArray(rawOp) ? rawOp.map(String) : [String(rawOp)];

				const built: Order = {
					id: orderId,
					partNumber: String(metadata.partNumber ?? ""),
					machine: deviceLabel(foundDevice) || deviceId || "Unknown Device",
					operator: String(metadata.operatorCode ?? ""),
					date: selectedDate,
					shift: (() => {
						if (shiftToUse.includes("Night") || shiftToUse === "Night") return "Night Shift (S2)";
						if (shiftToUse.includes("General") || shiftToUse === "General") return "General Shift (S3)";
						return "Day Shift (S1)";
					})(),
					startTime: toTimeHHMM(item?.segmentStart ?? null) || "",
					endTime: toTimeHHMM(item?.segmentEnd ?? null) || "",
					code: String(metadata.operatorCode ?? ""),
					opNumber: opNumber,
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
				};

				if (cancelled) return;
				setResolvedOrder(built);
				setEventItemId(String(item?.id ?? ""));
				setEventGroupId(String(foundGroup.id ?? ""));
				setItemCategory(category || "PLANNED_OUTPUT");
				setGroupRangeStart(typeof foundGroup.rangeStart === "string" ? foundGroup.rangeStart : "");
				setGroupRangeEnd(typeof foundGroup.rangeEnd === "string" ? foundGroup.rangeEnd : "");

				// Seed local storage for future
				addOrder(built);

				if (built.status === "ACTUAL_OUTPUT") {
					setActualOutput(built.actualOutput ?? 0);
				} else {
					setActualOutput(built.target ?? built.batch ?? 0);
				}
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
					workOrderId: built.workOrder || "N/A",
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
	const displayID = order?.workOrder || "N/A";
	const displayDate = order ? new Date(order.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
	const target = order.target || 1;
	const efficiency = Math.round((actualOutput / target) * 100);
	const visualEfficiency = Math.min(efficiency, 100);
	const progressPercent = Math.min((actualOutput / target) * 100, 100);

	const handleSave = async () => {
		if (!orderId || isSaving) return;
		setIsSaving(true);

		if (lighthouseEnabled && order.lhtDeviceId) {
			try {
				// 1. Determine Shift Range (Authoritative)
				const range =
					groupRangeStart && groupRangeEnd
						? { rangeStart: groupRangeStart, rangeEnd: groupRangeEnd }
						: toIsoShiftRange(order.date, order.shift);

				if (!range || !range.rangeStart || !range.rangeEnd) {
					toast.error("Unable to determine shift window");
					setIsSaving(false);
					return;
				}

				const rangeStartMs = new Date(range.rangeStart).getTime();
				const rangeEndMs = new Date(range.rangeEnd).getTime();

				// 2. Build Segment Times & Auto-Correct for Overnight/Next-Day
				const baseDate = groupRangeStart || order.date;
				let sStart = buildSegmentDateTime(baseDate, actualStartTime);
				let sEnd = buildSegmentDateTime(baseDate, actualEndTime);

				if (!sStart || !sEnd) {
					toast.error("Invalid start or end time");
					setIsSaving(false);
					return;
				}

				let sStartMs = new Date(sStart).getTime();
				let sEndMs = new Date(sEnd).getTime();

				// If Start is earlier than Range Start (e.g. 01:00 AM for a Night Shift starting 20:00 PM previous day),
				// assume it belongs to the "next day" part of the shift.
				// For Day Shift, this makes it "Tomorrow 07:00" which correctly fails validation.
				if (sStartMs < rangeStartMs) {
					const d = new Date(sStartMs);
					d.setDate(d.getDate() + 1);
					sStart = d.toISOString();
					sStartMs = d.getTime();
				}

				// If End is earlier than Start, it crosses midnight
				if (sEndMs < sStartMs) {
					const d = new Date(sEndMs);
					d.setDate(d.getDate() + 1);
					sEnd = d.toISOString();
					sEndMs = d.getTime();
				}

				// 3. Strict Validation
				if (sStartMs < rangeStartMs || sEndMs > rangeEndMs) {
					// Format range start/end for display
					const rangeStartStr = new Date(rangeStartMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
					const rangeEndStr = new Date(rangeEndMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

					toast.error(`Time must be within ${order.shift} (${rangeStartStr} - ${rangeEndStr})`, {
						description: "Please check your entered Actual Start/End times.",
						duration: 4000,
					});
					setIsSaving(false);
					return;
				}

				// Assign to variables used in payload
				const segmentStart = sStart;
				const segmentEnd = sEnd;

				// For new groups (PLANNED), ensure range covers the segment end if somehow it goes beyond (shouldn't happen with strict validation above, but kept for safety/logic consistency)
				if (itemCategory === "PLANNED_OUTPUT" && new Date(segmentEnd) > new Date(range.rangeEnd)) {
					range.rangeEnd = segmentEnd;
				}

				console.log("[DEBUG] handleSave - itemCategory:", itemCategory, "eventGroupId:", eventGroupId, "eventItemId:", eventItemId);

				if (itemCategory === "PLANNED_OUTPUT") {
					// PLANNED: Create a NEW group with category COMPLETED
					const createdGroup = await createDeviceStateEventGroup({
						deviceId: order.lhtDeviceId,
						account: {},
						body: {
							rangeStart: range?.rangeStart,
							rangeEnd: range?.rangeEnd,
							title: `COMPLETED-${order.date}`,
							items: [
								{
									segmentStart: segmentStart || actualStartTime,
									segmentEnd: segmentEnd || actualEndTime,
									category: "ACTUAL_OUTPUT",
									operatorCode: order.code,
									partNumber: order.partNumber,
									workOrder: order.workOrder,
									opBatchQty: order.batch,
									estPartAdd: order.estPart,
									metadata: {
										workOrder: order.workOrder || "N/A",
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
										annotationType: "COMPLETED",
									},
								},
							],
						},
					});

					// Update state so subsequent saves update the existing COMPLETED group
					if (createdGroup) {
						const newGroupId = String(createdGroup.id ?? "");
						const newItemId = Array.isArray(createdGroup.Items) && createdGroup.Items[0] ? String(createdGroup.Items[0].id ?? "") : "";

						// NOTE: We do NOT update the local 'eventGroupId' state immediately because we are navigating away.

						const newAssignment: Order = {
							...order,
							id: newGroupId, // New ID for the actual record
							status: "ACTUAL_OUTPUT",
							actualOutput,
							toolChanges,
							rejects,
							actualStartTime,
							actualEndTime,
							remarks,
							lhtGroupId: newGroupId,
							lhtItemId: newItemId,
						};

						// Optimistic Global Update (Create - Append, don't replace)
						setGlobalAssignments((prev) => {
							if (!prev) return prev;
							return [...prev, newAssignment];
						});

						// Local Storage Sync (Add new)
						addOrder(newAssignment);

						toast.success("Order completed successfully");
						router.push("/stock");
						return;
					}
				} else {
					// COMPLETED: Update existing item in the existing group
					// Use eventGroupId (the actual group ID) instead of order.lhtGroupId (which is the work order ID)
					const groupIdToUse = eventGroupId || order.lhtGroupId!;
					await updateDeviceStateEventGroupItems({
						deviceId: order.lhtDeviceId,
						groupId: groupIdToUse,
						account: {},
						items: [
							{
								id: eventItemId,
								segmentStart,
								segmentEnd,
								category: "ACTUAL_OUTPUT",
								operatorCode: order.code,
								partNumber: order.partNumber,
								workOrder: order.workOrder || "N/A",
								opBatchQty: order.batch,
								estPartAdd: order.estPart,
								metadata: {
									workOrder: order.workOrder || "N/A",
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
									annotationType: "COMPLETED",
								},
							},
						],
					});

					// Optimistic Global Update (Update existing)
					setGlobalAssignments((prev) => {
						if (!prev) return prev;
						return prev.map((a) => {
							if (a.id === orderId || a.lhtGroupId === orderId) {
								return {
									...a,
									status: "ACTUAL_OUTPUT",
									actualOutput,
									toolChanges,
									rejects,
									actualStartTime,
									actualEndTime,
									remarks,
								};
							}
							return a;
						});
					});

					// Local Storage Sync (Update)
					updateOrder(orderId, {
						status: "ACTUAL_OUTPUT",
						actualOutput,
						toolChanges,
						rejects,
						actualStartTime,
						actualEndTime,
						remarks,
					});

					toast.success("Order updated successfully");
					router.push("/stock");
					return;
				}
			} catch (e: any) {
				console.error(e);
				const respData = e.response?.data;
				const isOverlapError =
					(e.response?.status === 409 || respData?.status === 409) &&
					(respData?.error?.code === 1203 || respData?.message?.includes("Overlapping"));

				if (isOverlapError) {
					toast.error("In this time range there is already assignment existed so create in new time range");
				} else {
					toast.error("Failed to submit completion to Lighthouse");
				}
				setIsSaving(false);
				return;
			}
		}

		// Fallback for non-Lighthouse mode (Local Only)
		updateOrder(orderId, {
			status: "ACTUAL_OUTPUT",
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
									disabled={isSaving}
									className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none"
								>
									Cancel
								</button>
								<button
									onClick={handleSave}
									disabled={isSaving}
									className="bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform disabled:opacity-70 disabled:pointer-events-none min-w-[60px] flex justify-center items-center"
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
				<main className={cn("!p-4 !space-y-3 !pb-24", isSaving && "opacity-60 pointer-events-none")}>
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
										<CustomDatePicker
											showTimeSelectOnly
											value={actualStartTime}
											onChange={(val) => setActualStartTime(val)}
											dateFormat="hh:mm aa"
											customInput={
												<button
													type="button"
													className="w-full text-left bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto cursor-pointer block"
												>
													{formatTimeDisplay(actualStartTime) || "00:00 AM"}
												</button>
											}
										/>
									</div>
									<div className="w-px bg-primary/20"></div>
									<div className="flex-1 flex flex-col justify-center">
										<p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">Actual End</p>
										<CustomDatePicker
											showTimeSelectOnly
											value={actualEndTime}
											onChange={(val) => setActualEndTime(val)}
											dateFormat="hh:mm aa"
											customInput={
												<button
													type="button"
													className="w-full text-left bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto cursor-pointer block"
												>
													{formatTimeDisplay(actualEndTime) || "00:00 AM"}
												</button>
											}
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
