import type { BatchReadRequest, BatchReadResponse } from "@/utils/scripts";

export interface DownloadEventsRequest extends BatchReadRequest {
	clusterId?: string;
	applicationId?: string;
}

export interface ParsedDownloadEventsRequest {
	clusterId?: string;
	applicationId?: string;
	body: BatchReadRequest;
}

export interface DownloadTransactionRecord {
	TransactionID: number;
	TransactionDTTM: string;
	EquipmentID: string;
	MachineCode: string;
	StartTime: string;
	EndTime: string;
	Duration: number;
	Code: string;
	ReasonCode: string;
}

const REQUIRED_BODY_FIELDS: Array<keyof BatchReadRequest> = ["deviceIds", "startDate", "endDate"];

export const parseDownloadRequest = async (request: Request): Promise<ParsedDownloadEventsRequest> => {
	const rawPayload = (await request.json()) as Partial<DownloadEventsRequest> | null;
	const payload = rawPayload ?? {};

	for (const field of REQUIRED_BODY_FIELDS) {
		const value = payload[field];
		if (field === "deviceIds") {
			if (!Array.isArray(value) || value.length === 0) {
				throw new Error("`deviceIds` must be a non-empty array.");
			}
			continue;
		}

		if (typeof value !== "string" || value.trim().length === 0) {
			throw new Error(`\`${field}\` is required.`);
		}
	}

	const body: BatchReadRequest = {
		deviceIds: payload.deviceIds as string[],
		startDate: payload.startDate as string,
		endDate: payload.endDate as string,
		startTime: payload.startTime,
		endTime: payload.endTime,
		statuses: payload.statuses,
		minDurationMinutes: payload.minDurationMinutes,
	};

	return {
		clusterId: payload.clusterId,
		applicationId: payload.applicationId,
		body,
	};
};

const toIso = (value: string | null | undefined): string => {
	if (!value) return "";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
};

const makePeriodKey = (startTime: string, endTime: string): string => `${startTime}|${endTime}`;

const getReasonCodeByPeriod = (groups: NonNullable<BatchReadResponse["data"][string]["groups"]>) => {
	const reasonMap = new Map<string, string>();

	for (const group of groups ?? []) {
		const annotationType = String(group.metadata?.annotationType ?? "").toLowerCase();
		if (annotationType !== "event") continue;

		for (const item of group.Items ?? []) {
			const startTime = toIso(item.segmentStart);
			const endTime = toIso(item.segmentEnd);
			if (!startTime || !endTime) continue;

			const reasonCode = String(item.metadata?.reasonCode ?? item.notes ?? "").trim();
			if (!reasonCode) continue;

			reasonMap.set(makePeriodKey(startTime, endTime), reasonCode);
		}
	}

	return reasonMap;
};

const hashTo3Digits = (value: string): number => {
	let hash = 0;
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
	}
	return hash % 1000;
};

const buildTransactionId = (equipmentId: string, startTime: string, endTime: string, code: string): number => {
	const startMs = Date.parse(startTime);
	if (Number.isNaN(startMs)) {
		return hashTo3Digits(`${equipmentId}|${startTime}|${endTime}|${code}`);
	}

	// 13-digit epoch-ms * 1000 + 3-digit stable suffix => deterministic integer id.
	return startMs * 1000 + hashTo3Digits(`${equipmentId}|${startTime}|${endTime}|${code}`);
};

export const toTransactionRecords = (response: BatchReadResponse): DownloadTransactionRecord[] => {
	const rows: DownloadTransactionRecord[] = [];
	const devices = response.data ?? {};

	for (const [deviceId, deviceData] of Object.entries(devices)) {
		const machineCode = String(deviceData.foreignId ?? deviceData.deviceName ?? deviceId);
		const reasonByPeriod = getReasonCodeByPeriod(deviceData.groups ?? []);

		for (const period of deviceData.periods ?? []) {
			const startTime = toIso(period.startTime);
			const endTime = toIso(period.endTime);
			const code = String(period.status ?? "");
			const reasonCode = reasonByPeriod.get(makePeriodKey(startTime, endTime)) ?? "";
			const transactionDTTM = startTime || new Date().toISOString();

			rows.push({
				TransactionID: buildTransactionId(deviceId, startTime, endTime, code),
				TransactionDTTM: transactionDTTM,
				EquipmentID: deviceId,
				MachineCode: machineCode,
				StartTime: startTime,
				EndTime: endTime,
				Duration: Math.max(0, Math.round(Number(period.durationMinutes ?? 0))),
				Code: code,
				ReasonCode: reasonCode,
			});
		}
	}

	rows.sort((a, b) => a.TransactionID - b.TransactionID);
	return rows;
};

const csvEscape = (value: unknown): string => {
	const stringValue = String(value ?? "");
	if (!/[",\r\n]/.test(stringValue)) return stringValue;
	return `"${stringValue.replace(/"/g, "\"\"")}"`;
};

export const toCsv = (rows: DownloadTransactionRecord[]): string => {
	const headers = [
		"TransactionID",
		"TransactionDTTM",
		"EquipmentID",
		"MachineCode",
		"StartTime",
		"EndTime",
		"Duration",
		"Code",
		"ReasonCode",
	];
	const dataRows = rows.map((row) =>
		[
			row.TransactionID,
			row.TransactionDTTM,
			row.EquipmentID,
			row.MachineCode,
			row.StartTime,
			row.EndTime,
			row.Duration,
			row.Code,
			row.ReasonCode,
		].map(csvEscape),
	);

	return [headers, ...dataRows].map((row) => row.join(",")).join("\n");
};

export const buildDownloadFilename = (format: "json" | "csv"): string => {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	return `events-batch-${timestamp}.${format}`;
};
