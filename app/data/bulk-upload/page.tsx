"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
	batchReadDeviceStateEvents,
	fetchDeviceList,
	syncDeviceStateEventGroups,
	type DeviceSummary,
	type EventGroup,
	type EventItem,
	type BatchReadResponse,
	type SyncGroupCreateInput,
	type SyncItemUpdateInput,
} from "@/utils/scripts";
import {
	getReasonCategory,
	getReasonDescription,
	IDLE_REASON_CODES,
	OFFLINE_REASON_CODES,
	ONLINE_REASON_CODES,
	UNAVAILABLE_REASON_CODES,
} from "@/components/ReasonCodeSelect";
import { useData } from "@/context/DataContext";
import Select from "@/components/ui/Select";
import { cn } from "@/lib/utils";

interface UploadRow {
	rowNumber: number;
	machineId: string;
	startIso: string;
	endIso: string;
	status: string;
	reasonCode: string;
}

interface RejectedRow {
	rowNumber: number;
	reason: string;
	raw: Record<string, string>;
}

interface ParsedSheet {
	validRows: UploadRow[];
	rejectedRows: RejectedRow[];
}

interface UploadedFileMeta {
	name: string;
	size: number;
	type: string;
}

interface GroupItemMatch extends EventItem {
	groupId: string;
	annotationType?: string;
}

const MACHINE_ID_ALIASES = ["machineid", "deviceid", "machine", "device"];
const STATUS_ALIASES = ["status", "type", "eventstatus"];
const REASON_ALIASES = ["reasoncode", "reason", "reasonid", "currentreason", "notes"];
const DATE_ALIASES = ["date", "eventdate", "startdate", "enddate"];
const START_ALIASES = ["rawstarttimeutc", "rawstarttime", "starttimeutc", "startutc", "segmentstart", "starttime", "starttimeist", "start", "eventstart"];
const END_ALIASES = ["rawendtimeutc", "rawendtime", "endtimeutc", "endutc", "segmentend", "endtime", "endtimeist", "end", "eventend"];

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeIso = (value?: string | Date | null) => {
	if (!value) return "";
	const parsed = value instanceof Date ? value : new Date(value);
	return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
};

const excelSerialToIso = (value: number) => {
	const ms = Math.round((value - 25569) * 86400 * 1000);
	return new Date(ms).toISOString();
};

const parseDateToIso = (value: string) => {
	const trimmed = String(value || "").trim();
	if (!trimmed) return null;

	if (/^\d+(\.\d+)?$/.test(trimmed)) {
		const serial = Number(trimmed);
		if (serial > 25000 && serial < 80000) return excelSerialToIso(serial);
	}

	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString();
};

const isTimeOnly = (value: string) => {
	const v = String(value || "").trim().toLowerCase();
	return /^\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/.test(v);
};

const formatDateTimeForDisplay = (value: string) => {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toLocaleString("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
	});
};

const parseDateAndTimeToIso = (dateValue: string, timeValue: string) => {
	const d = String(dateValue || "").trim();
	const t = String(timeValue || "").trim();
	if (!d || !t) return null;
	const parsed = new Date(`${d} ${t}`);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString();
};

const pickFirst = (row: Record<string, string>, aliases: string[]) => {
	for (const key of aliases) {
		const v = row[key];
		if (v !== undefined && String(v).trim()) return String(v).trim();
	}
	return "";
};

const parseReasonCode = (value: string) => {
	const raw = String(value || "").trim();
	if (!raw) return "";
	const match = raw.match(/\d+/);
	return match ? match[0] : raw;
};

const formatFileSize = (bytes: number) => {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let idx = 0;
	while (size >= 1024 && idx < units.length - 1) {
		size /= 1024;
		idx++;
	}
	return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const normalizeStatusForReasonValidation = (status: string) => {
	const normalized = String(status || "").trim().toUpperCase();
	if (["OFFLINE"].includes(normalized)) return "OFFLINE";
	if (["IDLE", "STANDBY"].includes(normalized)) return "IDLE";
	if (["RUNNING", "ACTIVE"].includes(normalized)) return "RUNNING";
	if (["UNAVAILABLE"].includes(normalized)) return "UNAVAILABLE";
	return null;
};

const getAllowedReasonCodesForStatus = (status: string) => {
	const normalized = normalizeStatusForReasonValidation(status);
	if (!normalized) return null;
	if (normalized === "OFFLINE") return new Set(OFFLINE_REASON_CODES.map((entry) => entry.code));
	if (normalized === "IDLE") return new Set(IDLE_REASON_CODES.map((entry) => entry.code));
	if (normalized === "RUNNING") return new Set(ONLINE_REASON_CODES.map((entry) => entry.code));
	return new Set(UNAVAILABLE_REASON_CODES.map((entry) => entry.code));
};

const parseCsvLine = (line: string) => {
	const out: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (ch === "," && !inQuotes) {
			out.push(current.trim());
			current = "";
		} else {
			current += ch;
		}
	}
	out.push(current.trim());
	return out;
};

const extractRowsFromHtmlTable = (html: string) => {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");
	const table = doc.querySelector("table");
	if (!table) return [] as Record<string, string>[];

	const rows = Array.from(table.querySelectorAll("tr"));
	if (rows.length < 2) return [];

	const headers = Array.from(rows[0].querySelectorAll("th,td")).map((cell) => normalizeHeader(cell.textContent || ""));
	return rows.slice(1).map((row) => {
		const cells = Array.from(row.querySelectorAll("td"));
		const rec: Record<string, string> = {};
		headers.forEach((h, idx) => {
			rec[h] = (cells[idx]?.textContent || "").trim();
		});
		return rec;
	});
};

const extractRowsFromCsv = (text: string) => {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length < 2) return [] as Record<string, string>[];

	const headers = parseCsvLine(lines[0]).map(normalizeHeader);
	return lines.slice(1).map((line) => {
		const vals = parseCsvLine(line);
		const rec: Record<string, string> = {};
		headers.forEach((h, idx) => {
			rec[h] = vals[idx] || "";
		});
		return rec;
	});
};

const parseSheet = (records: Record<string, string>[]): ParsedSheet => {
	const validRows: UploadRow[] = [];
	const rejectedRows: RejectedRow[] = [];

	for (let i = 0; i < records.length; i++) {
		const row = records[i];
		const rowNumber = i + 1;

		const machineId = pickFirst(row, MACHINE_ID_ALIASES);
		const status = pickFirst(row, STATUS_ALIASES).toUpperCase();
		const reasonCode = parseReasonCode(pickFirst(row, REASON_ALIASES));
		const dateValue = pickFirst(row, DATE_ALIASES);
		const startRaw = pickFirst(row, START_ALIASES);
		const endRaw = pickFirst(row, END_ALIASES);

		// Skip fully empty lines silently (common in edited sheets).
		if (!machineId && !status && !reasonCode && !startRaw && !endRaw) {
			continue;
		}

		const missing: string[] = [];
		if (!machineId) missing.push("machineid");
		if (!status) missing.push("status");
		if (!reasonCode) missing.push("reasoncode");
		if (!startRaw) missing.push("starttime");
		if (!endRaw) missing.push("endtime");
		if (missing.length > 0) {
			rejectedRows.push({ rowNumber, reason: `Missing required fields: ${missing.join(", ")}`, raw: row });
			continue;
		}

		// Upload expects full datetime values in Start/End columns.
		// Time-only entries cause ambiguity, especially for cross-day events.
		if (isTimeOnly(startRaw) || isTimeOnly(endRaw)) {
			rejectedRows.push({
				rowNumber,
				reason: `Start/End must be full date-time (start: "${startRaw}", end: "${endRaw}")`,
				raw: row,
			});
			continue;
		}

		const allowedReasonCodes = getAllowedReasonCodesForStatus(status);
		if (!allowedReasonCodes) {
			rejectedRows.push({
				rowNumber,
				reason: `Unsupported status for reason validation: "${status}"`,
				raw: row,
			});
			continue;
		}
		if (!allowedReasonCodes.has(reasonCode)) {
			rejectedRows.push({
				rowNumber,
				reason: `Reason code "${reasonCode}" is invalid for status "${status}"`,
				raw: row,
			});
			continue;
		}

		let startIso = parseDateToIso(startRaw);
		let endIso = parseDateToIso(endRaw);
		if ((!startIso || !endIso) && dateValue && isTimeOnly(startRaw) && isTimeOnly(endRaw)) {
			startIso = parseDateAndTimeToIso(dateValue, startRaw);
			endIso = parseDateAndTimeToIso(dateValue, endRaw);
		}
		if ((!startIso || !endIso) && dateValue) {
			startIso = startIso || parseDateAndTimeToIso(dateValue, startRaw);
			endIso = endIso || parseDateAndTimeToIso(dateValue, endRaw);
		}

		if (!startIso || !endIso) {
			rejectedRows.push({
				rowNumber,
				reason: `Invalid Start/End time (start: "${startRaw || "N/A"}", end: "${endRaw || "N/A"}")`,
				raw: row,
			});
			continue;
		}

		if (new Date(startIso).getTime() >= new Date(endIso).getTime()) {
			rejectedRows.push({
				rowNumber,
				reason: `Start must be before End (start: "${startRaw}", end: "${endRaw}")`,
				raw: row,
			});
			continue;
		}

		validRows.push({ rowNumber, machineId, startIso, endIso, status, reasonCode });
	}

	return { validRows, rejectedRows };
};

const buildItemsIndex = (groups: EventGroup[]) => {
	const out: GroupItemMatch[] = [];
	for (const group of groups) {
		const annotationType = (group.metadata as Record<string, unknown> | undefined)?.annotationType;
		for (const item of group.Items || []) {
			out.push({ ...item, groupId: group.id, annotationType: typeof annotationType === "string" ? annotationType : undefined });
		}
	}
	return out;
};

export default function BulkUploadPage() {
	const router = useRouter();
	const { eventsDevices, setEventsDevices } = useData();
	const [uploadedFile, setUploadedFile] = useState<UploadedFileMeta | null>(null);
	const [fileInputKey, setFileInputKey] = useState(0);
	const [parsed, setParsed] = useState<ParsedSheet>({ validRows: [], rejectedRows: [] });
	const [isParsing, setIsParsing] = useState(false);
	const [isApplying, setIsApplying] = useState(false);
	const [showRejectedRows, setShowRejectedRows] = useState(false);
	const [previewQuery, setPreviewQuery] = useState("");
	const [previewDeviceFilter, setPreviewDeviceFilter] = useState("All");
	const [previewPageSize, setPreviewPageSize] = useState(20);
	const [previewPage, setPreviewPage] = useState(1);

	useEffect(() => {
		if (eventsDevices.length > 0) return;
		fetchDeviceList({}).then(setEventsDevices).catch(console.error);
	}, [eventsDevices.length, setEventsDevices]);

	const deviceMap = useMemo(() => {
		const map = new Map<string, DeviceSummary>();
		eventsDevices.forEach((device) => map.set(device.id, device));
		return map;
	}, [eventsDevices]);

	const previewDeviceOptions = useMemo(() => {
		const uniqueIds = Array.from(new Set(parsed.validRows.map((row) => row.machineId)));
		return [
			{ label: "All Devices", value: "All" },
			...uniqueIds.map((id) => ({ label: deviceMap.get(id)?.deviceName || id, value: id })),
		];
	}, [parsed.validRows, deviceMap]);

	const filteredPreviewRows = useMemo(() => {
		const query = previewQuery.trim().toLowerCase();
		return parsed.validRows.filter((row) => {
			const deviceName = deviceMap.get(row.machineId)?.deviceName || "";
			const matchesQuery =
				!query ||
				row.machineId.toLowerCase().includes(query) ||
				deviceName.toLowerCase().includes(query) ||
				row.status.toLowerCase().includes(query) ||
				row.reasonCode.toLowerCase().includes(query) ||
				String(row.rowNumber).includes(query);
			const matchesDevice = previewDeviceFilter === "All" || row.machineId === previewDeviceFilter;
			return matchesQuery && matchesDevice;
		});
	}, [parsed.validRows, previewQuery, previewDeviceFilter, deviceMap]);

	const totalPreviewPages = Math.max(1, Math.ceil(filteredPreviewRows.length / previewPageSize));
	const currentPreviewPage = Math.min(previewPage, totalPreviewPages);
	const previewRows = useMemo(() => {
		const start = (currentPreviewPage - 1) * previewPageSize;
		return filteredPreviewRows.slice(start, start + previewPageSize);
	}, [filteredPreviewRows, currentPreviewPage, previewPageSize]);

	const handleFileChange = async (file: File | null) => {
		if (!file) return;
		setIsParsing(true);
		setUploadedFile({ name: file.name, size: file.size, type: file.type || "unknown" });
		setParsed({ validRows: [], rejectedRows: [] });
		setShowRejectedRows(false);
		setPreviewQuery("");
		setPreviewDeviceFilter("All");
		setPreviewPage(1);

		try {
			if (/\.xlsx$/i.test(file.name)) {
				toast.error("`.xlsx` is not supported yet. Upload the direct exported `.xls` file or `.csv`.");
				return;
			}

			const text = await file.text();
			let records: Record<string, string>[] = [];

			if (/\.csv$/i.test(file.name)) {
				records = extractRowsFromCsv(text);
			} else {
				records = extractRowsFromHtmlTable(text);
				if (records.length === 0) {
					records = extractRowsFromCsv(text);
				}
			}

			if (records.length === 0) {
				toast.error("Could not read rows. Use app-exported .xls (HTML table) or .csv format.");
				return;
			}

			const parsedSheet = parseSheet(records);
			setParsed(parsedSheet);

			if (parsedSheet.validRows.length === 0) {
				toast.error("No valid rows found in file");
			} else {
				toast.success(`Loaded ${parsedSheet.validRows.length} valid rows`);
			}
		} catch (error) {
			console.error(error);
			toast.error("Failed to parse file");
		} finally {
			setIsParsing(false);
		}
	};

	const handleRemoveFile = () => {
		setUploadedFile(null);
		setParsed({ validRows: [], rejectedRows: [] });
		setFileInputKey((prev) => prev + 1);
		setShowRejectedRows(false);
		setPreviewQuery("");
		setPreviewDeviceFilter("All");
		setPreviewPage(1);
	};

	const handleApply = async () => {
		if (parsed.validRows.length === 0) {
			toast.error("Upload a valid file first");
			return;
		}

		setIsApplying(true);
		try {
			const uniqueDeviceIds = Array.from(new Set(parsed.validRows.map((r) => r.machineId)));
			const minStartMs = Math.min(...parsed.validRows.map((r) => new Date(r.startIso).getTime()));
			const maxEndMs = Math.max(...parsed.validRows.map((r) => new Date(r.endIso).getTime()));

			const minDate = new Date(minStartMs).toISOString().split("T")[0];
			const maxDate = new Date(maxEndMs).toISOString().split("T")[0];

			const batch: BatchReadResponse = await batchReadDeviceStateEvents({
				body: {
					deviceIds: uniqueDeviceIds,
					startDate: minDate,
					endDate: maxDate,
					startTime: "00:00:00",
					endTime: "23:59:59",
				},
			});

			const updatesByGroup = new Map<string, { deviceId: string; itemById: Map<string, SyncItemUpdateInput> }>();
			const createsByRange = new Map<string, SyncGroupCreateInput>();

			for (const row of parsed.validRows) {
				const deviceData = batch.data?.[row.machineId];
				const groups = Array.isArray(deviceData?.groups) ? deviceData.groups : [];
				const items = buildItemsIndex(groups);

				const rowStartNorm = normalizeIso(row.startIso);
				const rowEndNorm = normalizeIso(row.endIso);

				const matched = items.find((item) => {
					const startNorm = normalizeIso(item.segmentStart);
					const endNorm = normalizeIso(item.segmentEnd);
					return startNorm === rowStartNorm && endNorm === rowEndNorm && item.annotationType === "event";
				});

				const metadata = {
					reasonCode: Number(row.reasonCode),
					reasonDescription: getReasonDescription(row.reasonCode),
				};

				if (matched?.id && matched.groupId) {
					if (!updatesByGroup.has(matched.groupId)) {
						updatesByGroup.set(matched.groupId, { deviceId: row.machineId, itemById: new Map() });
					}

					updatesByGroup.get(matched.groupId)!.itemById.set(matched.id, {
						id: matched.id,
						segmentStart: row.startIso,
						segmentEnd: row.endIso,
						category: getReasonCategory(row.reasonCode),
						scopeType: "DEVICE_STATUS",
						metadata,
					});
				} else {
					const key = `${row.machineId}|${row.startIso}|${row.endIso}`;
					createsByRange.set(key, {
						deviceId: row.machineId,
						rangeStart: row.startIso,
						rangeEnd: row.endIso,
						title: `EVENT-${row.startIso.split("T")[0]}`,
						metadata: { annotationType: "event" },
						items: [
							{
								segmentStart: row.startIso,
								segmentEnd: row.endIso,
								state: row.status,
								category: getReasonCategory(row.reasonCode),
								scopeType: "DEVICE_STATUS",
								metadata: {
									...metadata,
									annotationType: "event",
								},
							},
						],
					});
				}
			}

			const update = Array.from(updatesByGroup.entries()).map(([groupId, data]) => ({
				groupId,
				deviceId: data.deviceId,
				items: { update: Array.from(data.itemById.values()) },
			}));

			const create = Array.from(createsByRange.values());

			if (update.length === 0 && create.length === 0) {
				toast.error("No rows could be mapped for update/create");
				return;
			}

			await syncDeviceStateEventGroups({
				body: {
					update: update.length ? update : undefined,
					create: create.length ? create : undefined,
				},
			});

			toast.success(`Applied ${parsed.validRows.length} row(s): ${update.length} update group(s), ${create.length} create group(s)`);
			router.push("/data");
		} catch (error) {
			console.error(error);
			toast.error("Bulk upload apply failed");
		} finally {
			setIsApplying(false);
		}
	};

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard font-display">
			<header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-(--header-height) px-4 py-2">
				<div className="flex items-center justify-between h-full">
					<div className="flex flex-col">
						<h2 className="header-title">Bulk Upload</h2>
						<p className="header-subtitle mt-0.5 uppercase block">UPLOAD FILE & APPLY REASON CODES</p>
					</div>
					<div className="flex items-center gap-3">
						<button
							onClick={() => router.back()}
							className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform"
						>
							BACK
						</button>
						<button
							onClick={handleApply}
							disabled={isApplying || parsed.validRows.length === 0}
							className="bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform disabled:opacity-70 disabled:pointer-events-none min-w-[60px] flex justify-center items-center"
						>
							{isApplying ? <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "APPLY"}
						</button>
					</div>
				</div>
			</header>

			<div className="flex-1 p-4 flex flex-col items-center">
				<div className="w-full max-w-2xl space-y-4">
					<section className="bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden">
						<div className="bg-gray-50 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center rounded-t-xl">
							<h3 className="font-bold text-sm uppercase tracking-wider text-primary">Upload File</h3>
							<span className="material-symbols-outlined text-gray-400 !text-2xl">upload_file</span>
						</div>
						<div className="p-4 space-y-3">
								<p className="text-[11px] text-gray-500">
									Required columns:{" "}
									<span className="font-semibold">Machine ID, Start Time (full date-time), End Time (full date-time), Status, Reason Code</span>
								</p>

							<div className="grid grid-cols-2 gap-3">
								<div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
									<p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Valid Rows</p>
									<p className="text-lg font-extrabold text-gray-800">{parsed.validRows.length}</p>
								</div>
								<div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
									<p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Rejected Rows</p>
									<p className="text-lg font-extrabold text-gray-800">{parsed.rejectedRows.length}</p>
								</div>
							</div>

								{uploadedFile && (
									<div className="w-full h-12 rounded-lg border border-dashed border-gray-300/80 bg-gray-100/50 px-3 flex items-center justify-between gap-3">
										<div className="min-w-0 flex items-center gap-2">
											<span className="material-symbols-outlined text-[18px] text-primary">article</span>
											<div className="min-w-0">
												<p className="text-xs font-medium text-primary truncate">{uploadedFile.name}</p>
												<p className="text-[10px] text-gray-500">{formatFileSize(uploadedFile.size)}</p>
											</div>
										</div>
										<button
											type="button"
											onClick={handleRemoveFile}
											className="size-6 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center transition-all"
											aria-label="Remove file"
											title="Remove file"
										>
											<span className="material-symbols-outlined text-[14px]">close</span>
										</button>
									</div>
								)}
						</div>
					</section>

						{parsed.validRows.length > 0 ? (
							<section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
								<div className="bg-gray-50 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center rounded-t-xl">
									<h3 className="font-bold text-sm uppercase tracking-wider text-primary">Preview</h3>
									<span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{filteredPreviewRows.length} rows</span>
								</div>
								<div className="px-4 py-2 border-b border-gray-100 space-y-2">
									<div className="grid grid-cols-2 gap-2">
										<input
											type="text"
												value={previewQuery}
											onChange={(e) => {
												setPreviewQuery(e.target.value);
												setPreviewPage(1);
											}}
												placeholder="Search..."
												className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-xs"
											/>
											<Select
												value={previewDeviceFilter}
												onChange={(value) => {
													setPreviewDeviceFilter(value);
													setPreviewPage(1);
												}}
												options={previewDeviceOptions}
												className="h-8 bg-white text-xs"
											/>
										</div>
										<div className="flex items-center justify-between">
											<Select
												value={String(previewPageSize)}
												onChange={(value) => {
													setPreviewPageSize(Number(value));
													setPreviewPage(1);
												}}
												options={[
													{ label: "10 / page", value: "10" },
													{ label: "20 / page", value: "20" },
													{ label: "50 / page", value: "50" },
												]}
												className="h-7 min-w-24 bg-white text-[10px]"
											/>
										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
												disabled={currentPreviewPage <= 1}
												className="h-7 px-2 rounded-md border border-gray-200 bg-white text-[10px] font-bold text-gray-600 disabled:opacity-40"
											>
												Prev
											</button>
											<span className="text-[10px] font-bold text-gray-500">
												{currentPreviewPage}/{totalPreviewPages}
											</span>
											<button
												type="button"
												onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
												disabled={currentPreviewPage >= totalPreviewPages}
												className="h-7 px-2 rounded-md border border-gray-200 bg-white text-[10px] font-bold text-gray-600 disabled:opacity-40"
											>
												Next
											</button>
										</div>
									</div>
								</div>
								<div className="p-3 space-y-2">
									{previewRows.length === 0 ? (
										<div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
											<p className="text-xs font-bold text-gray-700">No rows match current filters</p>
										</div>
									) : (
										previewRows.map((row) => {
										const device = deviceMap.get(row.machineId);
										const deviceName = device?.deviceName || row.machineId;
										const startText = formatDateTimeForDisplay(row.startIso);
										const endText = formatDateTimeForDisplay(row.endIso);

										return (
											<div key={`${row.rowNumber}-${row.machineId}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0">
														<p className="text-xs font-bold text-gray-800 truncate">{deviceName}</p>
														<p className="text-[10px] text-gray-500 break-all">ID: {row.machineId}</p>
													</div>
													<span className="text-[10px] font-bold text-gray-600 bg-white border border-gray-200 rounded px-2 py-0.5">
														Row {row.rowNumber}
													</span>
												</div>
												<div className="mt-2 text-[11px] text-gray-600 space-y-1">
													<p>
														<span className="font-semibold text-gray-700">Start:</span> {startText}
													</p>
													<p>
														<span className="font-semibold text-gray-700">End:</span> {endText}
													</p>
												</div>
												<div className="mt-2 flex items-center gap-2">
													<span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-white border border-primary/30 rounded px-2 py-0.5">
														{row.status}
													</span>
													<span className="text-[10px] font-bold uppercase tracking-wider text-gray-700 bg-white border border-gray-200 rounded px-2 py-0.5">
														Reason {row.reasonCode}
													</span>
												</div>
											</div>
											);
										})
									)}
								</div>
							</section>
						) : (
							<section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
								<div className="max-w-sm mx-auto text-center space-y-3">
									<p className="text-xs font-bold uppercase tracking-wider text-gray-700">Upload File To Preview</p>
									<p className="text-[11px] text-gray-500">Upload your event sheet to preview and apply updates.</p>
										{uploadedFile ? (
											<div className="w-full h-12 rounded-lg border border-dashed border-gray-300/80 bg-gray-100/50 px-3 flex items-center justify-between gap-3">
												<div className="min-w-0 flex items-center gap-2">
													<span className="material-symbols-outlined text-[18px] text-primary">article</span>
													<div className="min-w-0 text-left">
														<p className="text-xs font-medium text-primary truncate">{uploadedFile.name}</p>
														<p className="text-[10px] text-gray-500">{formatFileSize(uploadedFile.size)}</p>
													</div>
												</div>
												<button
													type="button"
													onClick={handleRemoveFile}
													className="size-6 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center transition-all"
													aria-label="Remove file"
													title="Remove file"
												>
													<span className="material-symbols-outlined text-[14px]">close</span>
												</button>
											</div>
										) : (
											<label className="w-full rounded-xl border-2 border-dashed border-primary/50 bg-primary/[0.03] px-4 py-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-primary/[0.06] transition-all active:scale-[0.995]">
												<span className="material-symbols-outlined text-[44px] text-primary leading-none">upload</span>
												<span className="h-9 min-w-36 px-5 rounded-full bg-primary text-white text-sm font-bold inline-flex items-center justify-center shadow-sm">
													{isParsing ? "Parsing..." : "Browse"}
												</span>
												<span className="text-sm text-gray-400 font-medium">drop a file here</span>
												<span className="text-xs text-gray-600">
													<span className="text-red-500 font-bold">*</span> Supported: <span className="font-semibold">.xls, .csv, .txt</span>
												</span>
												<input
													key={`empty-${fileInputKey}`}
													type="file"
													accept=".xls,.csv,.txt"
													className="hidden"
													onChange={(e) => void handleFileChange(e.target.files?.[0] || null)}
													disabled={isParsing || isApplying}
												/>
											</label>
										)}
								</div>
							</section>
						)}

						{parsed.rejectedRows.length > 0 && (
							<section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
								<button
									type="button"
									onClick={() => setShowRejectedRows((prev) => !prev)}
									className="w-full px-4 py-3 border-b border-gray-100 flex items-center justify-between text-left"
								>
									<div className="min-w-0">
										<p className="text-xs font-bold uppercase tracking-wider text-red-700">Rejected Rows</p>
										<p className="text-[11px] text-gray-500 mt-0.5">{parsed.rejectedRows.length} rows could not be parsed</p>
									</div>
									<span
										className={cn(
											"material-symbols-outlined text-gray-500 transition-transform",
											showRejectedRows && "rotate-180",
										)}
									>
										expand_more
									</span>
								</button>

								{showRejectedRows && (
									<div className="p-3 space-y-2 max-h-72 overflow-auto">
										{parsed.rejectedRows.slice(0, 50).map((row) => (
											<div key={row.rowNumber} className="rounded-lg border border-red-100 bg-red-50/50 p-3 space-y-1.5">
												<div className="flex items-start justify-between gap-2">
													<p className="text-xs font-bold text-red-700">Row {row.rowNumber}</p>
												</div>
												<p className="text-[11px] text-red-700">{row.reason}</p>
												<div className="text-[10px] text-red-800/90 space-y-0.5 border-t border-red-100 pt-1.5">
													<p>Machine ID: {pickFirst(row.raw, MACHINE_ID_ALIASES) || "N/A"}</p>
													<p>Start: {pickFirst(row.raw, START_ALIASES) || "N/A"}</p>
													<p>End: {pickFirst(row.raw, END_ALIASES) || "N/A"}</p>
													<p>Status: {pickFirst(row.raw, STATUS_ALIASES) || "N/A"}</p>
													<p>Reason Code: {pickFirst(row.raw, REASON_ALIASES) || "N/A"}</p>
													<p>Date: {pickFirst(row.raw, DATE_ALIASES) || "N/A"}</p>
												</div>
											</div>
										))}
									</div>
								)}
							</section>
						)}
				</div>
			</div>
		</div>
	);
}
