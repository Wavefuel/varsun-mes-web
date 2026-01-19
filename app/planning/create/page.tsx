"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import AssignmentDetailsCard, { type AssignmentFormData } from "@/components/AssignmentDetailsCard";
import { CustomToast } from "@/components/CustomToast";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import { useData } from "@/context/DataContext";
import type { Assignment } from "@/lib/types";
import {
	createDeviceStateEventGroup,
	createDeviceStateEventGroupItems,
	fetchDeviceList,
	readDeviceStateEventGroupsWithItemsByCluster,
	updateDeviceStateEventGroup,
	type DeviceSummary,
	type UpdateDeviceStateEventGroupData,
} from "@/utils/scripts";

function AssignmentForm() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const {
		addOrder,
		currentDate,
		getOrderById,
		orders,
		globalAssignments,
		globalDataDate,
		setCurrentDate,
		setGlobalAssignments,
		setGlobalDataDate,
		updateOrder,
		globalDevices,
		setGlobalDevices,
		currentShift,
	} = useData();

	const orderId = searchParams.get("id");
	const isEditMode = Boolean(orderId);
	const queryDeviceId = searchParams.get("deviceId") ?? "";
	const queryDate = searchParams.get("date") ?? "";

	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID ?? "";
	const lhtAccountId = process.env.NEXT_PUBLIC_LHT_ACCOUNT_ID ?? "";
	const lhtApplicationId = process.env.NEXT_PUBLIC_APPLICATION_ID ?? "";

	const [devices, setDevices] = useState<DeviceSummary[]>(globalDevices);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);
	const [isError, setIsError] = useState(false);

	// Form inputs state
	const [machine, setMachine] = useState("CNC-042 (Alpha)");
	const [operator, setOperator] = useState("");
	const [date, setDate] = useState(() => queryDate || currentDate);
	const [shift, setShift] = useState(() => (currentShift === "Day" ? "Day Shift (S1)" : "Night Shift (S2)"));
	const [startTime, setStartTime] = useState("08:00");
	const [endTime, setEndTime] = useState("20:00");
	const [code, setCode] = useState("");
	const [partNumber, setPartNumber] = useState("");
	const [workOrderId, setWorkOrderId] = useState("");
	const [opNumber, setOpNumber] = useState<string[]>([]);
	const [batch, setBatch] = useState(450);
	const [estTime, setEstTime] = useState("1.5");
	const [estUnit, setEstUnit] = useState<"min" | "hr">("min");
	const [errors, setErrors] = useState<Record<string, boolean>>({});

	// Needed for edit-mode updates (API item id is not the same as group id).
	const [eventItemId, setEventItemId] = useState<string>("");
	const [eventGroupId, setEventGroupId] = useState<string>("");

	const estPart = useMemo(() => `${estTime}${estUnit === "hr" ? "h" : "m"}`, [estTime, estUnit]);

	const deviceLabel = (device?: DeviceSummary) => device?.deviceName || device?.serialNumber || device?.foreignId || device?.id || "Unknown Device";

	const timeToMinutes = (value: string) => {
		const [h, m] = value.split(":").map((p) => Number(p));
		return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
	};

	const buildDateTimeIso = (dateValue: string, timeValue: string, dayOffset = 0) => {
		if (!dateValue || !timeValue) return undefined;
		const base = new Date(dateValue);
		if (Number.isNaN(base.getTime())) return undefined;
		const [hours, minutes] = timeValue.split(":").map((part) => Number(part));
		base.setDate(base.getDate() + dayOffset);
		base.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
		return base.toISOString();
	};

	const buildSegmentRangeIso = (dateValue: string, startHHMM: string, endHHMM: string) => {
		const start = buildDateTimeIso(dateValue, startHHMM, 0);
		if (!start) return null;
		const overnight = timeToMinutes(endHHMM) <= timeToMinutes(startHHMM);
		const end = buildDateTimeIso(dateValue, endHHMM, overnight ? 1 : 0);
		if (!end) return null;
		return { start, end };
	};

	const isNightShift = (value: string) => /night/i.test(value) || /S2/i.test(value);

	const getShiftWindow = (value: string) => {
		if (/custom/i.test(value)) return { start: startTime, end: endTime };
		return isNightShift(value) ? { start: "20:00", end: "08:00" } : { start: "08:00", end: "20:00" };
	};

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
		if (!value) return "";
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return "";
		return d.toISOString().slice(11, 16);
	};

	const extractCreatedItemId = (payload: unknown, expectedSegmentStart: string | null, woId: string) => {
		if (!payload || typeof payload !== "object") return undefined;
		const group = payload as Record<string, unknown>;
		const items = Array.isArray(group.Items) ? (group.Items as Record<string, unknown>[]) : [];
		const match = items.find((item) => {
			const metadata = item?.metadata && typeof item.metadata === "object" ? (item.metadata as Record<string, unknown>) : {};
			const workOrder = String(metadata.workOrder ?? "");
			if (!workOrder || workOrder !== woId) return false;
			const segmentStart = item?.segmentStart ? String(item.segmentStart) : "";
			return !expectedSegmentStart || !segmentStart || segmentStart === expectedSegmentStart;
		});
		return typeof match?.id === "string" ? match.id : undefined;
	};

	const findLocalGroupId = () => {
		if (!globalAssignments || globalDataDate !== `${date}:${currentShift}`) return undefined;
		const match = globalAssignments.find(
			(item) =>
				item.lhtDeviceId === selectedDeviceId &&
				(currentShift === "Day" ? item.shift === "Day Shift (S1)" : item.shift === "Night Shift (S2)") &&
				item.date === date &&
				item.lhtGroupId,
		);
		if (!match?.lhtGroupId) return undefined;
		return match.lhtGroupId;
	};

	useEffect(() => {
		let cancelled = false;
		const loadData = async () => {
			if (!lhtClusterId || !lhtAccountId || !lhtApplicationId) {
				return;
			}

			setIsLoading(true);

			try {
				const selectedDate = queryDate || date || currentDate;

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

				// 1. Fetch Devices (Always needed)
				let deviceList = devices;
				if (deviceList.length === 0) {
					deviceList = await fetchDeviceList({ clusterId: lhtClusterId });
					if (cancelled) return;
					setDevices(deviceList);
					setGlobalDevices(deviceList);
				}

				// 2. Fetch Assignments if missing (needed for Planned Queue)
				if (globalDataDate !== `${selectedDate}:${currentShift}` || !globalAssignments) {
					// Calculate shift-based range
					const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
					const [yPart, mPart, dPart] = selectedDate.split("-").map(Number);
					let startRange, endRange;

					if (currentShift === "Day") {
						startRange = new Date(Date.UTC(yPart, mPart - 1, dPart, 8, 0, 0, 0) - IST_OFFSET_MS).toISOString();
						endRange = new Date(Date.UTC(yPart, mPart - 1, dPart, 20, 0, 0, 0) - IST_OFFSET_MS).toISOString();
					} else {
						startRange = new Date(Date.UTC(yPart, mPart - 1, dPart, 20, 0, 0, 0) - IST_OFFSET_MS).toISOString();
						endRange = new Date(Date.UTC(yPart, mPart - 1, dPart + 1, 8, 0, 0, 0) - IST_OFFSET_MS).toISOString();
					}

					const groupsUnknown = await readDeviceStateEventGroupsWithItemsByCluster({
						clusterId: lhtClusterId,
						applicationId: lhtApplicationId,
						account: { id: lhtAccountId },
						query: { rangeStart: startRange, rangeEnd: endRange },
						deviceId: undefined,
					});

					const groups: ApiEventGroup[] = Array.isArray(groupsUnknown) ? (groupsUnknown as ApiEventGroup[]) : [];
					const mapped: Assignment[] = groups.flatMap((group) => {
						const groupShift = currentShift === "Day" ? "Day Shift (S1)" : "Night Shift (S2)";

						const deviceId = typeof group?.deviceId === "string" ? group.deviceId : "";
						const machineName = (() => {
							if (!deviceId) return "Unknown Device";
							const dev = deviceList.find((d: DeviceSummary) => d.id === deviceId);
							return dev ? deviceLabel(dev) : deviceId;
						})();

						const items = Array.isArray(group?.Items) ? group.Items : [];
						return items.flatMap((item) => {
							const metadata = item?.metadata ?? {};
							const wo = String(metadata.workOrder ?? "");
							if (!wo) return [];

							const startTimeValue = toTimeHHMM(item?.segmentStart ?? null);
							const endTimeValue = toTimeHHMM(item?.segmentEnd ?? null);
							const category = typeof item?.category === "string" ? String(item.category).toUpperCase() : "";
							const status: Assignment["status"] = category === "COMPLETED" ? "COMPLETED" : "PLANNED";

							const rawOp = metadata.opNumber ?? "0";
							const op = Array.isArray(rawOp) ? rawOp.map(String) : [String(rawOp)];

							return [
								{
									id: String(group?.id ?? wo),
									workOrder: wo,
									partNumber: String(metadata.partNumber ?? ""),
									machine: machineName,
									operator: String(metadata.operatorCode ?? ""),
									date: selectedDate,
									shift: groupShift,
									startTime: startTimeValue,
									endTime: endTimeValue,
									code: String(metadata.operatorCode ?? ""),
									opNumber: op,
									batch: Number(metadata.opBatchQty ?? 0),
									estPart: String(metadata.estPartAdd ?? ""),
									target: Number(metadata.opBatchQty ?? 0),
									status,
									lhtDeviceId: deviceId || undefined,
									lhtGroupId: String(group?.id ?? ""),
									lhtItemId: String(item?.id ?? ""),
								},
							];
						});
					});

					if (!cancelled) {
						setGlobalAssignments(mapped);
						setGlobalDataDate(`${selectedDate}:${currentShift}`);
					}
				}

				// 3. Handle Create Mode (Default Selection) vs Edit Mode (Load Order)
				if (!isEditMode || !orderId) {
					// --- CREATE MODE ---
					if (deviceList.length > 0) {
						const preferred =
							queryDeviceId && queryDeviceId !== "ALL" ? deviceList.find((d: DeviceSummary) => d.id === queryDeviceId) : undefined;
						const pick = preferred ?? deviceList[0];

						if (pick) {
							setSelectedDeviceId((prev) => prev || pick.id);
							setMachine((prev) => (prev === "CNC-042 (Alpha)" && pick.id !== "CNC-042 (Alpha)" ? deviceLabel(pick) : prev));
						}
					}
					setIsLoading(false);
					return;
				}

				// --- EDIT MODE ---
				const cached = globalAssignments?.find((p) => p.id === orderId || p.lhtGroupId === orderId);
				if (cached) {
					setMachine(cached.machine);
					setOperator(cached.operator);
					setDate(cached.date);
					setShift(cached.shift);
					setStartTime(cached.startTime);
					setEndTime(cached.endTime);
					setCode(cached.code);
					setPartNumber(cached.partNumber);
					setWorkOrderId(cached.workOrder || "");
					setOpNumber(Array.isArray(cached.opNumber) ? cached.opNumber : []);
					setBatch(cached.batch);

					const parsedEst = cached.estPart || "1.5m";
					if (parsedEst.endsWith("h")) {
						setEstUnit("hr");
						setEstTime(parsedEst.replace(/h$/, ""));
					} else {
						setEstUnit("min");
						setEstTime(parsedEst.replace(/m$/, ""));
					}

					if (cached.lhtDeviceId) setSelectedDeviceId(cached.lhtDeviceId);
					if (cached.lhtGroupId) setEventGroupId(cached.lhtGroupId);
					if (cached.lhtItemId) setEventItemId(cached.lhtItemId);

					setIsLoading(false);
					return;
				}

				const legacyExisting = getOrderById(orderId);
				if (legacyExisting) {
					setMachine(legacyExisting.machine);
					setOperator(legacyExisting.operator);
					setDate(legacyExisting.date);
					setShift(legacyExisting.shift);
					setStartTime(legacyExisting.startTime);
					setEndTime(legacyExisting.endTime);
					setCode(legacyExisting.code || "");
					setPartNumber(legacyExisting.partNumber);
					setWorkOrderId(legacyExisting.id);
					const op = legacyExisting.opNumber;
					setOpNumber(Array.isArray(op) ? op : []);
					setBatch(legacyExisting.batch || 450);

					const parsedEst = legacyExisting.estPart || "1.5m";
					if (parsedEst.endsWith("h")) {
						setEstUnit("hr");
						setEstTime(parsedEst.replace(/h$/, ""));
					} else {
						setEstUnit("min");
						setEstTime(parsedEst.replace(/m$/, ""));
					}

					if (legacyExisting.lhtDeviceId) setSelectedDeviceId(legacyExisting.lhtDeviceId);
					setIsLoading(false);
					return;
				}

				// API fallback
				const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
				const [yFall, mFall, dFall] = selectedDate.split("-").map(Number);
				let startRange, endRange;
				if (currentShift === "Day") {
					startRange = new Date(Date.UTC(yFall, mFall - 1, dFall, 8, 0, 0, 0) - IST_OFFSET_MS).toISOString();
					endRange = new Date(Date.UTC(yFall, mFall - 1, dFall, 20, 0, 0, 0) - IST_OFFSET_MS).toISOString();
				} else {
					startRange = new Date(Date.UTC(yFall, mFall - 1, dFall, 20, 0, 0, 0) - IST_OFFSET_MS).toISOString();
					endRange = new Date(Date.UTC(yFall, mFall - 1, dFall + 1, 8, 0, 0, 0) - IST_OFFSET_MS).toISOString();
				}

				const groupsUnknownFallback = await readDeviceStateEventGroupsWithItemsByCluster({
					clusterId: lhtClusterId,
					applicationId: lhtApplicationId,
					account: { id: lhtAccountId },
					query: { rangeStart: startRange, rangeEnd: endRange },
					deviceId: queryDeviceId && queryDeviceId !== "ALL" ? queryDeviceId : undefined,
				});

				const groupsFall: ApiEventGroup[] = Array.isArray(groupsUnknownFallback) ? (groupsUnknownFallback as ApiEventGroup[]) : [];
				const foundGroup =
					groupsFall.find((g) => String(g?.id ?? "") === orderId) ??
					groupsFall.find((g) =>
						(Array.isArray(g?.Items) ? g.Items : []).some((entry: ApiEventItem) => {
							const md = entry?.metadata as Record<string, unknown> | undefined;
							return String(md?.workOrder ?? "") === orderId;
						}),
					) ??
					null;

				if (!foundGroup) {
					toast.error("Order not found");
					router.push("/planning");
					return;
				}

				const item = Array.isArray(foundGroup.Items) ? foundGroup.Items[0] : null;
				const metadata = item?.metadata ?? {};
				setEventGroupId(String(foundGroup.id ?? ""));

				const foundDeviceId = String(foundGroup.deviceId ?? "");
				const foundDevice = deviceList.find((d: DeviceSummary) => d.id === foundDeviceId);
				const label = foundDevice ? deviceLabel(foundDevice) : foundDeviceId || "Unknown Device";

				const rs = typeof foundGroup.rangeStart === "string" ? new Date(foundGroup.rangeStart) : null;
				const re = typeof foundGroup.rangeEnd === "string" ? new Date(foundGroup.rangeEnd) : null;
				const isNight = rs && re && rs.toDateString() !== re.toDateString();

				const metaDataObj = metadata as Record<string, unknown>;
				const workOrder = String(metaDataObj.workOrder ?? "");
				const pn = String(metaDataObj.partNumber ?? "");
				const oc = String(metaDataObj.operatorCode ?? "");
				const b = Number(metaDataObj.opBatchQty ?? 450);
				const ep = String(metaDataObj.estPartAdd ?? "1.5m");

				if (cancelled) return;
				setSelectedDeviceId(foundDeviceId);
				setMachine(label);
				setDate(selectedDate);
				setShift(isNight ? "Night Shift (S2)" : "Day Shift (S1)");
				setStartTime(toTimeHHMM(item?.segmentStart ?? null) || "08:00");
				setEndTime(toTimeHHMM(item?.segmentEnd ?? null) || "20:00");
				setCode(oc || "");
				setPartNumber(pn);
				setWorkOrderId(workOrder);
				setBatch(Number.isFinite(b) ? b : 450);
				setEventItemId(String(item?.id ?? ""));

				if (ep.endsWith("h")) {
					setEstUnit("hr");
					setEstTime(ep.replace(/h$/, ""));
				} else {
					setEstUnit("min");
					setEstTime(ep.replace(/m$/, ""));
				}
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
		// Only depend on ID/Mode changes and stable env vars.
		// NOT date or devices state, preventing loops.
		isEditMode,
		orderId,
		lhtClusterId,
		lhtAccountId,
		lhtApplicationId,
		queryDeviceId,
		// queryDate might change, so we include it.
		// If user navigates to same page with different date content, we should reload.
		queryDate,
		getOrderById,
		router,
		currentDate, // used as fallback for date
		currentShift,
	]);

	const handleSave = async () => {
		const newErrors: Record<string, boolean> = {};
		if (!partNumber) newErrors.partNumber = true;
		if (!workOrderId) newErrors.workOrderId = true;
		if (!code) newErrors.code = true;
		if (!operator) newErrors.operator = true;
		if (!opNumber || opNumber.length === 0) newErrors.opNumber = true;

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			toast.error("Please complete all required fields");
			return;
		}

		const groupWindow = getShiftWindow(shift);
		const groupRange = buildSegmentRangeIso(date, groupWindow.start, groupWindow.end);
		if (!groupRange) {
			toast.error("Invalid shift window");
			return;
		}

		let itemSegment = buildSegmentRangeIso(date, startTime, endTime);
		if (!itemSegment) {
			toast.error("Invalid start/end time");
			return;
		}

		// Night shift: treat early-morning times (e.g. 02:00) as part of the same
		// overnight window (20:00–08:00) by placing them on the next calendar day.
		if (isNightShift(shift)) {
			const shiftWindow = getShiftWindow(shift); // typically 20:00–08:00
			const startMin = timeToMinutes(startTime);
			const endMin = timeToMinutes(endTime);
			const windowEndMin = timeToMinutes(shiftWindow.end); // e.g. 08:00

			const isEarlyStart = startMin < windowEndMin;
			const isEarlyEnd = endMin <= windowEndMin;

			if (isEarlyStart && isEarlyEnd) {
				const startIso = buildDateTimeIso(date, startTime, 1);
				const endIso = buildDateTimeIso(date, endTime, 1);
				if (!startIso || !endIso) {
					toast.error("Invalid start/end time");
					return;
				}
				itemSegment = { start: startIso, end: endIso };
			}
		}

		const groupStartMs = new Date(groupRange.start).getTime();
		const groupEndMs = new Date(groupRange.end).getTime();
		const itemStartMs = new Date(itemSegment.start).getTime();
		const itemEndMs = new Date(itemSegment.end).getTime();
		if (
			!Number.isFinite(groupStartMs) ||
			!Number.isFinite(groupEndMs) ||
			!Number.isFinite(itemStartMs) ||
			!Number.isFinite(itemEndMs) ||
			itemStartMs < groupStartMs ||
			itemEndMs > groupEndMs
		) {
			setErrors((prev) => ({ ...prev, shift: true }));
			toast.error("Order time must be within the selected shift window");
			return;
		}

		const durationMinutes = Math.round((groupEndMs - groupStartMs) / 60000);
		let estPerPartMinutes = Number.parseFloat(estTime);
		if (!Number.isFinite(estPerPartMinutes) || estPerPartMinutes <= 0) estPerPartMinutes = 0;
		if (estUnit === "hr") estPerPartMinutes *= 60;

		const totalRequiredMinutes = batch * estPerPartMinutes;
		if (durationMinutes > 0 && estPerPartMinutes > 0 && totalRequiredMinutes > durationMinutes) {
			const reqHrs = Math.floor(totalRequiredMinutes / 60);
			const reqMins = Math.round(totalRequiredMinutes % 60);
			const shiftHrs = Math.floor(durationMinutes / 60);
			const shiftMins = Math.round(durationMinutes % 60);

			setErrors((prev) => ({ ...prev, capacity: true, shift: true }));
			toast.custom(
				(t) => (
					<CustomToast
						t={t}
						title="Capacity Limit Exceeded"
						message={
							<span>
								Required time{" "}
								<span className="font-bold">
									{reqHrs}h {reqMins}m
								</span>{" "}
								exceeds shift duration{" "}
								<span className="font-bold">
									{shiftHrs}h {shiftMins}m
								</span>
								.
							</span>
						}
						actions="Try reducing Batch Qty/Est. Part or extending Shift."
					/>
				),
				{ duration: 10000 },
			);
			return;
		}

		let lhtGroupId: string | undefined;
		let lhtDeviceId: string | undefined;
		let lhtItemId: string | undefined;

		// Lighthouse write (optional; app can still work in local-only mode).
		if (lhtClusterId && lhtAccountId && lhtApplicationId) {
			if (!selectedDeviceId) {
				toast.error("Please select a device");
				return;
			}

			try {
				if (isEditMode && orderId) {
					const resolvedGroupId = eventGroupId || orderId;
					const payload: UpdateDeviceStateEventGroupData = {
						deviceId: selectedDeviceId,
						clusterId: lhtClusterId,
						groupId: resolvedGroupId,
						applicationId: lhtApplicationId,
						account: { id: lhtAccountId },
						body: {
							group: {
								rangeStart: groupRange.start,
								rangeEnd: groupRange.end,
								title: `PLANNED-${date}`,
							},
							items: {
								update: [
									{
										id: eventItemId || resolvedGroupId,
										segmentStart: itemSegment.start,
										segmentEnd: itemSegment.end,
										category: "PLANNED",
										operatorCode: code,
										partNumber,
										workOrder: workOrderId,
										opBatchQty: batch,
										estPartAdd: estPart,
									},
								],
							},
						},
					};
					await updateDeviceStateEventGroup(payload);
					lhtGroupId = orderId;
					lhtDeviceId = selectedDeviceId;
				} else {
					let existingGroupId = findLocalGroupId();

					if (!existingGroupId) {
						const groupsUnknown = await readDeviceStateEventGroupsWithItemsByCluster({
							clusterId: lhtClusterId,
							applicationId: lhtApplicationId,
							account: { id: lhtAccountId },
							query: { rangeStart: groupRange.start, rangeEnd: groupRange.end },
							deviceId: selectedDeviceId,
						});

						type ApiEventGroup = {
							id?: string;
							deviceId?: string;
							rangeStart?: string | null;
							rangeEnd?: string | null;
						};

						const groups: ApiEventGroup[] = Array.isArray(groupsUnknown) ? (groupsUnknown as ApiEventGroup[]) : [];
						const matching = groups.find((group) => {
							if (group?.deviceId !== selectedDeviceId) return false;
							if (!group?.rangeStart || !group?.rangeEnd) return false;
							const rangeStartMs = new Date(group.rangeStart).getTime();
							const rangeEndMs = new Date(group.rangeEnd).getTime();
							return rangeStartMs === groupStartMs && rangeEndMs === groupEndMs;
						});

						existingGroupId = typeof matching?.id === "string" ? matching.id : undefined;
					}

					if (existingGroupId) {
						const updatedGroup = await createDeviceStateEventGroupItems({
							deviceId: selectedDeviceId,
							clusterId: lhtClusterId,
							applicationId: lhtApplicationId,
							groupId: existingGroupId,
							account: { id: lhtAccountId },
							items: [
								{
									segmentStart: itemSegment.start,
									segmentEnd: itemSegment.end,
									category: "PLANNED",
									operatorCode: code,
									partNumber,
									workOrder: workOrderId,
									opBatchQty: batch,
									estPartAdd: estPart,
								},
							],
						});
						lhtItemId = extractCreatedItemId(updatedGroup, itemSegment.start, workOrderId);
						lhtGroupId = existingGroupId;
						lhtDeviceId = selectedDeviceId;
					} else {
						const created = await createDeviceStateEventGroup({
							deviceId: selectedDeviceId,
							clusterId: lhtClusterId,
							applicationId: lhtApplicationId,
							account: { id: lhtAccountId },
							body: {
								// Shift-wise group range (not full day)
								rangeStart: groupRange.start,
								rangeEnd: groupRange.end,
								title: `PLANNED-${date}`,
								items: [
									{
										segmentStart: itemSegment.start,
										segmentEnd: itemSegment.end,
										category: "PLANNED",
										operatorCode: code,
										partNumber,
										workOrder: workOrderId,
										opBatchQty: batch,
										estPartAdd: estPart,
									},
								],
							},
						});
						lhtItemId = extractCreatedItemId(created, itemSegment.start, workOrderId);

						if (created && typeof created === "object") {
							const maybeCreated = created as Record<string, unknown>;
							lhtGroupId = typeof maybeCreated.id === "string" ? maybeCreated.id : undefined;
							lhtDeviceId = typeof maybeCreated.deviceId === "string" ? maybeCreated.deviceId : selectedDeviceId;
						} else {
							lhtDeviceId = selectedDeviceId;
						}
					}
				}
			} catch (error) {
				console.error(error);
				toast.error(isEditMode ? "Failed to update assignment" : "Failed to save assignment");
				return;
			}
		} else {
			toast.message("Saved locally (Lighthouse not configured)");
		}

		const orderData = {
			partNumber,
			machine,
			operator,
			date,
			shift,
			startTime,
			endTime,
			code,
			opNumber,
			batch,
			estPart,
			target: batch,
			status: "PLANNED" as const,
			lhtDeviceId,
			lhtGroupId,
		};

		if (lhtDeviceId && lhtGroupId && !isEditMode) {
			const assignment: Assignment = {
				id: lhtGroupId,
				workOrder: workOrderId,
				...orderData,
				lhtItemId,
			};
			setGlobalAssignments((prev) => {
				const base = prev ? [...prev] : [];
				const filtered = base.filter(
					(item) =>
						item.workOrder !== assignment.workOrder ||
						item.lhtGroupId !== assignment.lhtGroupId ||
						item.lhtDeviceId !== assignment.lhtDeviceId,
				);
				return [assignment, ...filtered];
			});
			setGlobalDataDate(`${date}:${currentShift}`);
		}

		// Store locally keyed by Work Order id.
		const existing = getOrderById(workOrderId);
		if (existing) {
			updateOrder(workOrderId, orderData);
		} else {
			addOrder({ id: workOrderId, ...orderData });
		}

		if (date !== currentDate) setCurrentDate(date);

		toast.success(isEditMode ? "Assignment updated" : "Assignment saved");
		router.push("/planning");
	};

	const formData = useMemo<AssignmentFormData>(
		() => ({
			machine,
			operator,
			date,
			shift,
			startTime,
			endTime,
			code,
			partNumber,
			workOrderId,
			opNumber,
			batch,
			estTime,
			estUnit,
		}),
		[batch, code, date, endTime, estTime, estUnit, machine, opNumber, operator, partNumber, shift, startTime, workOrderId],
	);

	const handleFormChange = useCallback(
		(field: keyof AssignmentFormData, value: unknown) => {
			switch (field) {
				case "machine":
					setMachine(value as string);
					break;
				case "operator":
					setOperator(value as string);
					if (errors.operator) setErrors((prev) => ({ ...prev, operator: false }));
					break;
				case "date":
					setDate(value as string);
					break;
				case "shift":
					setShift(value as string);
					break;
				case "startTime":
					setStartTime(value as string);
					break;
				case "endTime":
					setEndTime(value as string);
					break;
				case "code":
					setCode(value as string);
					if (errors.code) setErrors((prev) => ({ ...prev, code: false }));
					break;
				case "partNumber":
					setPartNumber(value as string);
					if (errors.partNumber) setErrors((prev) => ({ ...prev, partNumber: false }));
					break;
				case "workOrderId":
					setWorkOrderId(value as string);
					if (errors.workOrderId) setErrors((prev) => ({ ...prev, workOrderId: false }));
					break;
				case "opNumber":
					setOpNumber(value as string[]);
					if (errors.opNumber) setErrors((prev) => ({ ...prev, opNumber: false }));
					break;
				case "batch":
					setBatch(value as number);
					if (errors.capacity)
						setErrors((prev) => {
							const next = { ...prev };
							delete next.capacity;
							return next;
						});
					break;
				case "estTime":
					setEstTime(value as string);
					if (errors.capacity)
						setErrors((prev) => {
							const next = { ...prev };
							delete next.capacity;
							return next;
						});
					break;
				case "estUnit":
					setEstUnit(value as "min" | "hr");
					break;
			}
		},
		[errors.capacity, errors.partNumber, errors.workOrderId],
	);

	const handleDeviceChange = useCallback(
		(deviceId: string) => {
			setSelectedDeviceId(deviceId);
			const device = devices.find((d) => d.id === deviceId);
			setMachine(deviceLabel(device));
		},
		[devices],
	);

	const queueSource = useMemo(() => {
		if (globalAssignments !== null) return globalAssignments;
		return orders;
	}, [globalAssignments, orders]);

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard font-display">
			<header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-(--header-height) px-4 py-2">
				<div className="flex items-center justify-between h-full">
					<div className="flex flex-col">
						<h2 className="header-title">{isEditMode ? "Edit Assignment" : "Shift Assignment"}</h2>
						<p className="header-subtitle mt-0.5 uppercase block">Planning</p>
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
								Unable to retrieve assignment data. <br />
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
				<main className="p-4 space-y-6 pb-24 relative">
					<AssignmentDetailsCard
						title={isEditMode ? "Assignment Details" : "New Assignment"}
						icon={isEditMode ? "edit_note" : "precision_manufacturing"}
						data={formData}
						onChange={handleFormChange}
						errors={errors}
						readOnly={false}
						isEditMode={isEditMode}
						devices={devices}
						selectedDeviceId={selectedDeviceId}
						onDeviceChange={handleDeviceChange}
					/>

					{isLoading && (
						<div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center">
							<Loader />
						</div>
					)}

					{!isEditMode && (
						<section className="space-y-2">
							<div className="flex items-center justify-between px-1">
								<h3 className="font-bold text-sm uppercase tracking-wider text-gray-600">
									Planned Queue <span className="text-gray-400 normal-case tracking-normal">({machine.split(" ")[0]})</span>
								</h3>
								<span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
									{queueSource.filter((o) => o.machine === machine && o.date === date && o.status !== "COMPLETED").length} Tasks
								</span>
							</div>
							<div className="space-y-2">
								{queueSource
									.filter((o) => o.machine === machine && o.date === date && o.status !== "COMPLETED")
									.sort((a, b) => a.startTime.localeCompare(b.startTime))
									.map((order) => {
										// Compatible ID for display
										const displayId = (order as any).workOrder ?? order.id;
										return (
											<div key={order.id} className="bg-white border border-gray-100 p-3 rounded-lg flex items-center gap-3">
												<div className="size-10 bg-gray-100 rounded flex items-center justify-center shrink-0 text-gray-400">
													<span className="material-symbols-outlined text-xl">
														{order.status === "ACTIVE"
															? "play_circle"
															: order.status === "COMPLETED"
																? "check_circle"
																: "schedule"}
													</span>
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex justify-between items-start">
														<p className="font-bold text-sm truncate text-gray-800">
															{displayId} • {order.partNumber}
														</p>
														<span
															className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
																order.status === "ACTIVE"
																	? "text-green-600 bg-green-50"
																	: order.status === "COMPLETED"
																		? "text-blue-600 bg-blue-50"
																		: "text-gray-400 bg-gray-50"
															}`}
														>
															{order.status}
														</span>
													</div>
													<p className="text-[11px] text-gray-500 font-medium">
														Op {order.opNumber} • {order.operator.split(" ")[0]} • {order.shift}
													</p>
												</div>
											</div>
										);
									})}

								{queueSource.filter((o) => o.machine === machine && o.date === date && o.status !== "COMPLETED").length === 0 && (
									<div className="text-center py-6 text-gray-400 text-xs italic bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
										No active queue for {machine.split(" ")[0]} on this date.
									</div>
								)}
							</div>
						</section>
					)}
				</main>
			)}
		</div>
	);
}

export default function CreateAssignmentPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<AssignmentForm />
		</Suspense>
	);
}
