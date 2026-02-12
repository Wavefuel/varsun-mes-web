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
import { getShiftDisplayName, buildUtcRangeFromIstDate, SHIFT_CONFIG, type ShiftDisplayName } from "@/utils/shiftUtils";

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

	const [devices, setDevices] = useState<DeviceSummary[]>(globalDevices);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isError, setIsError] = useState(false);

	// Form inputs state
	const [machine, setMachine] = useState("CNC-042 (Alpha)");
	const [operator, setOperator] = useState("");
	const [date, setDate] = useState(() => queryDate || currentDate);
	const [shift, setShift] = useState(() => getShiftDisplayName(currentShift));
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

	const parseTimeStr = (value: string) => {
		const upper = value.trim().toUpperCase();
		const isPM = upper.includes("PM");
		const isAM = upper.includes("AM");
		// Remove non-numeric/colon chars to get clean H:M
		const clean = upper.replace(/[^0-9:]/g, "");
		const parts = clean.split(":").map(Number);
		let h = parts[0] || 0;
		const m = parts[1] || 0;

		if (isPM && h < 12) h += 12;
		if (isAM && h === 12) h = 0;

		return { h, m };
	};

	const timeToMinutes = (value: string) => {
		const { h, m } = parseTimeStr(value);
		return h * 60 + m;
	};

	const buildDateTimeIso = (dateValue: string, timeValue: string, dayOffset = 0) => {
		if (!dateValue || !timeValue) return undefined;
		// Parse YYYY-MM-DD manually to avoid UTC vs Local ambiguity
		const dateParts = dateValue.split("-").map(Number);
		if (dateParts.length !== 3) return undefined;
		const [year, month, day] = dateParts;

		const { h, m } = parseTimeStr(timeValue);

		// Create date in LOCAL time to match user's perspective
		const base = new Date(year, month - 1, day, h, m, 0, 0);
		if (Number.isNaN(base.getTime())) return undefined;

		if (dayOffset !== 0) {
			base.setDate(base.getDate() + dayOffset);
		}
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
	const isGeneralShift = (value: string) => /general/i.test(value) || /S3/i.test(value);

	const getShiftWindow = (value: string) => {
		if (/custom/i.test(value)) return { start: startTime, end: endTime };
		if (isNightShift(value)) return { start: "20:00", end: "08:00" };
		if (isGeneralShift(value)) return { start: "08:30", end: "17:30" };
		return { start: "08:00", end: "20:00" };
	};

	const toIsoDayRange = (dateStr: string) => {
		const parts = dateStr.split("-").map(Number);
		if (parts.length !== 3) return null;
		const [y, m, d] = parts;
		const start = new Date(y, m - 1, d, 0, 0, 0, 0);
		const end = new Date(y, m - 1, d, 23, 59, 59, 999);
		if (Number.isNaN(start.getTime())) return null;
		return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
	};

	const toTimeHHMM = (value?: string | null) => {
		if (!value) return "";
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return "";
		const h = d.getHours().toString().padStart(2, "0");
		const m = d.getMinutes().toString().padStart(2, "0");
		return `${h}:${m}`;
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
			// Compare ISO strings
			if (!expectedSegmentStart || !segmentStart) return true;
			return new Date(segmentStart).getTime() === new Date(expectedSegmentStart).getTime();
		});
		return typeof match?.id === "string" ? match.id : undefined;
	};

	const findLocalGroupId = () => {
		if (!globalAssignments || globalDataDate !== `${date}:${currentShift}`) return undefined;
		const match = globalAssignments.find(
			(item) =>
				item.lhtDeviceId === selectedDeviceId && item.shift === getShiftDisplayName(currentShift) && item.date === date && item.lhtGroupId,
		);
		if (!match?.lhtGroupId) return undefined;
		return match.lhtGroupId;
	};

	useEffect(() => {
		let cancelled = false;
		const loadData = async () => {
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
					deviceList = await fetchDeviceList({});
					if (cancelled) return;
					setDevices(deviceList);
					setGlobalDevices(deviceList);
				}

				// 2. Fetch Assignments if missing (needed for Planned Queue)
				if (globalDataDate !== `${selectedDate}:${currentShift}` || !globalAssignments) {
					// Calculate shift-based range using utility
					const { fromDateUTC, toDateUTC } = buildUtcRangeFromIstDate(selectedDate, currentShift);
					const startRange = fromDateUTC.toISOString();
					const endRange = toDateUTC.toISOString();

					const groupsUnknown = await readDeviceStateEventGroupsWithItemsByCluster({
						query: { rangeStart: startRange, rangeEnd: endRange },
						deviceId: undefined,
					});

					const groups: ApiEventGroup[] = Array.isArray(groupsUnknown) ? (groupsUnknown as ApiEventGroup[]) : [];
					console.log("loadData: Fetched groups", groups);
					const mapped: Assignment[] = groups.flatMap((group) => {
						const groupShift = getShiftDisplayName(currentShift);

						const deviceId = typeof group?.deviceId === "string" ? group.deviceId : "";
						const machineName = (() => {
							if (!deviceId) return "Unknown Device";
							const dev = deviceList.find((d: DeviceSummary) => d.id === deviceId);
							return dev ? deviceLabel(dev) : deviceId;
						})();

						const items = Array.isArray(group?.Items) ? group.Items : [];
						return items.flatMap((item) => {
							const metadata = item?.metadata ?? {};
							console.log("loadData: Item metadata", metadata);
							const wo = String(metadata.workOrder ?? "");
							if (!wo) return [];

							const startTimeValue = toTimeHHMM(item?.segmentStart ?? null);
							const endTimeValue = toTimeHHMM(item?.segmentEnd ?? null);
							const category = typeof item?.category === "string" ? String(item.category).toUpperCase() : "";
							const status: Assignment["status"] = category === "ACTUAL_OUTPUT" ? "ACTUAL_OUTPUT" : "PLANNED_OUTPUT";

							const rawOp = metadata.opNumber ?? "0";
							const op = Array.isArray(rawOp) ? rawOp.map(String) : [String(rawOp)];

							return [
								{
									id: String(group?.id ?? wo),
									workOrder: wo,
									partNumber: String(metadata.partNumber ?? ""),
									machine: machineName,
									operator: String(metadata.operatorName ?? metadata.operator ?? metadata.name ?? metadata.operatorCode ?? ""),
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
					setShift(cached.shift as ShiftDisplayName);
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
					setShift(legacyExisting.shift as ShiftDisplayName);
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

				// API fallback - use utility for shift range calculation
				const { fromDateUTC: fromFallback, toDateUTC: toFallback } = buildUtcRangeFromIstDate(selectedDate, currentShift);
				const startRange = fromFallback.toISOString();
				const endRange = toFallback.toISOString();

				const groupsUnknownFallback = await readDeviceStateEventGroupsWithItemsByCluster({
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
				const rawOp = metaDataObj.opNumber ?? [];
				const finalOp = Array.isArray(rawOp) ? rawOp.map(String) : [String(rawOp)];

				if (cancelled) return;
				setSelectedDeviceId(foundDeviceId);
				setMachine(label);
				setDate(selectedDate);
				const nightCheck = isNight ? "Night Shift (S2)" : isGeneralShift(shift) ? "General Shift (S3)" : "Day Shift (S1)";
				setShift(nightCheck);
				setStartTime(toTimeHHMM(item?.segmentStart ?? null) || "08:00");
				setEndTime(toTimeHHMM(item?.segmentEnd ?? null) || "20:00");
				setOperator(String(metaDataObj.operatorName || metaDataObj.operator || metaDataObj.name || metaDataObj.operatorCode || ""));
				setCode(oc || "");
				setPartNumber(pn);
				setWorkOrderId(workOrder);
				setBatch(Number.isFinite(b) ? b : 450);
				setEventItemId(String(item?.id ?? ""));
				setOpNumber(finalOp);

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
		if (isSaving) return;
		setIsSaving(true);

		const newErrors: Record<string, boolean> = {};
		if (!partNumber) newErrors.partNumber = true;
		if (!workOrderId) newErrors.workOrderId = true;
		if (!code) newErrors.code = true;
		if (!operator) newErrors.operator = true;
		if (!opNumber || opNumber.length === 0) newErrors.opNumber = true;

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			toast.error("Please complete all required fields");
			setIsSaving(false);
			return;
		}

		// Helper to validate against a given shift
		const checkShiftValidity = (testShift: string) => {
			const groupWindow = getShiftWindow(testShift);
			const groupRange = buildSegmentRangeIso(date, groupWindow.start, groupWindow.end);
			if (!groupRange) return { valid: false, error: "Invalid shift window" };

			let itemSegment = buildSegmentRangeIso(date, startTime, endTime);
			if (!itemSegment) return { valid: false, error: "Invalid start/end time" };

			// Night shift adjustment for early morning hours (next day)
			if (isNightShift(testShift)) {
				const shiftWindow = getShiftWindow(testShift);
				const startMin = timeToMinutes(startTime);
				const endMin = timeToMinutes(endTime);
				const windowEndMin = timeToMinutes(shiftWindow.end);

				const isEarlyStart = startMin < windowEndMin;
				const isEarlyEnd = endMin <= windowEndMin;

				if (isEarlyStart && isEarlyEnd) {
					const startIso = buildDateTimeIso(date, startTime, 1);
					const endIso = buildDateTimeIso(date, endTime, 1);
					if (!startIso || !endIso) return { valid: false, error: "Invalid start/end time" }; // Should not happen if buildDateTimeIso works
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
				return { valid: false, error: "Order time must be within the selected shift window" };
			}

			return { valid: true, groupRange, itemSegment };
		};

		let result = checkShiftValidity(shift);
		let finalShift = shift;

		// If invalid, try auto-switching shift (unless Custom)
		if (!result.valid && !/custom/i.test(shift)) {
			const shifts: ShiftDisplayName[] = ["Day Shift (S1)", "General Shift (S3)", "Night Shift (S2)"];
			const currentIndex = shifts.findIndex((s) => s === shift);
			const otherShifts = shifts.filter((_, i) => i !== currentIndex);

			for (const otherShift of otherShifts) {
				const otherResult = checkShiftValidity(otherShift);
				if (otherResult.valid) {
					result = otherResult;
					finalShift = otherShift;
					setShift(finalShift);
					// Clear shift error if it was set
					setErrors((prev) => {
						const next = { ...prev };
						delete next.shift;
						return next;
					});
					break;
				}
			}
		}

		if (!result.valid || !result.groupRange || !result.itemSegment) {
			setErrors((prev) => ({ ...prev, shift: true }));
			toast.error(result.error || "Order time must be within the selected shift window");
			setIsSaving(false);
			return;
		}

		const { groupRange, itemSegment } = result;

		const groupStartMs = new Date(groupRange.start).getTime();
		const groupEndMs = new Date(groupRange.end).getTime();

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
			setIsSaving(false);
			return;
		}

		let lhtGroupId: string | undefined;
		let lhtDeviceId: string | undefined;
		let lhtItemId: string | undefined;

		// Lighthouse write (optional; app can still work in local-only mode).
		if (true) {
			if (!selectedDeviceId) {
				toast.error("Please select a device");
				setIsSaving(false);
				return;
			}

			try {
				if (isEditMode && orderId) {
					const resolvedGroupId = eventGroupId || orderId;

					if (!eventItemId) {
						toast.error("Critcal Error: Missing Item ID for update.");
						setIsSaving(false);
						return;
					}

					const payload: UpdateDeviceStateEventGroupData = {
						deviceId: selectedDeviceId,
						groupId: resolvedGroupId,
						body: {
							group: {
								rangeStart: groupRange.start,
								rangeEnd: groupRange.end,
								title: `PLANNED_OUTPUT-${date}`,
							},
							items: {
								update: [
									{
										id: eventItemId,
										segmentStart: itemSegment.start,
										segmentEnd: itemSegment.end,
										category: "PLANNED_OUTPUT",
										operatorCode: code,
										metadata: {
											operatorName: operator,
											operator: operator,
											name: operator,
											opNumber,
											annotationType: "PLANNING",
										},
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
					lhtItemId = eventItemId;
				} else {
					let existingGroupId = findLocalGroupId();

					if (!existingGroupId) {
						const groupsUnknown = await readDeviceStateEventGroupsWithItemsByCluster({
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
							groupId: existingGroupId,
							items: [
								{
									segmentStart: itemSegment.start,
									segmentEnd: itemSegment.end,
									category: "PLANNED_OUTPUT",
									operatorCode: code,
									metadata: { operatorName: operator, operator: operator, name: operator, opNumber, annotationType: "PLANNING" },
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
							body: {
								// Shift-wise group range (not full day)
								rangeStart: groupRange.start,
								rangeEnd: groupRange.end,
								title: `PLANNED_OUTPUT-${date}`,
								items: [
									{
										segmentStart: itemSegment.start,
										segmentEnd: itemSegment.end,
										category: "PLANNED_OUTPUT",
										operatorCode: code,
										metadata: {
											operatorName: operator,
											operator: operator,
											name: operator,
											opNumber,
											annotationType: "PLANNING",
										},
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
			} catch (error: any) {
				console.error(error);
				const respData = error.response?.data;
				const isOverlapError =
					(error.response?.status === 409 || respData?.status === 409) &&
					(respData?.error?.code === 1203 || respData?.message?.includes("Overlapping"));

				if (isOverlapError) {
					toast.error("In this time range there is already assignment existed so create in new time range");
				} else {
					toast.error(isEditMode ? "Failed to update assignment" : "Failed to save assignment");
				}
				setIsSaving(false);
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
			shift: finalShift,
			startTime,
			endTime,
			code,
			opNumber,
			batch,
			estPart,
			target: batch,
			status: "PLANNED_OUTPUT" as const,
			lhtDeviceId,
			lhtGroupId,
		};

		if (lhtDeviceId && lhtGroupId) {
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
		setIsSaving(false);
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
					setShift(value as ShiftDisplayName);
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
					<div className={isSaving ? "opacity-60 pointer-events-none" : ""}>
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
					</div>

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
									{queueSource.filter((o) => o.machine === machine && o.date === date && o.status !== "ACTUAL_OUTPUT").length} Tasks
								</span>
							</div>
							<div className="space-y-2">
								{queueSource
									.filter((o) => o.machine === machine && o.date === date && o.status !== "ACTUAL_OUTPUT")
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
															: order.status === "ACTUAL_OUTPUT"
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
																	: order.status === "ACTUAL_OUTPUT"
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

								{queueSource.filter((o) => o.machine === machine && o.date === date && o.status !== "ACTUAL_OUTPUT").length === 0 && (
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
