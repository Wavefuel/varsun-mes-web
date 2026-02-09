// Assuming these are imported from your API handler module
import { lightHouseAPIHandler } from "./lightHouse";

export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

export interface Account {
	id?: string;
	activeProjectId?: string;
	projectId?: string;
	// Add other account properties as needed
}

export interface DeviceStateEventItemInput {
	segmentStart: Date | string;
	segmentEnd: Date | string;
	startTime?: Date | string;
	endTime?: Date | string;
	state?: string | null;
	category?: string | null;
	impact?: JsonValue;
	scopeType?: "DEVICE_STATUS" | "CONNECTION_STATUS" | "PARAMETER" | "CUSTOM" | null;
	scopeKey?: string | null;
	notes?: string | null;
	metadata?: JsonValue;
	operatorCode?: string | null;
	partNumber?: string | null;
	workOrder?: string | null;
	opBatchQty?: number | null;
	estPartAdd?: string | number | null;
}

// ... (rest of existing interfaces)

/**
 * Batch Read API Types
 */
export interface BatchReadRequest {
	deviceIds: string[];
	startDate: string;
	endDate: string;
	startTime?: string;
	endTime?: string;
	statuses?: string[];
	minDurationMinutes?: number;
}

export interface StatusPeriod {
	status: string;
	startTime: string;
	endTime: string;
	durationSeconds: number;
	durationMinutes: number;
	isOngoing: boolean;
}

export interface EventItem {
	id: string;
	eventGroupId: string;
	deviceId: string;
	segmentStart: string;
	segmentEnd: string;
	category: string;
	impact: number | null;
	scopeType: string | null;
	scopeKey: string | null;
	notes: string | null;
	metadata: Record<string, any>;
}

export interface EventGroup {
	id: string;
	deviceId: string;
	rangeStart: string;
	rangeEnd: string;
	title: string;
	description: string | null;
	notes: string | null;
	metadata: Record<string, any>;
	tags: string[];
	Items: EventItem[];
}

export interface DeviceBatchData {
	deviceName: string;
	foreignId: string;
	periods: StatusPeriod[];
	groups: EventGroup[];
}

export interface BatchReadResponse {
	data: {
		[deviceId: string]: DeviceBatchData;
	};
	meta: {
		deviceCount: number;
		totalPeriods: number;
		totalGroups: number;
	};
	message: string;
}

export interface BatchReadData {
	clusterId: string;
	applicationId?: string;
	body: BatchReadRequest;
}

/**
 * Batch Read API - Fetch status periods and event groups for multiple devices
 *
 * This replaces 2N individual API calls with a single batch call.
 *
 * @param data - Batch read request data
 * @returns Combined periods and groups data for all devices
 *
 * @example
 * const result = await batchReadDeviceStateEvents({
 *   clusterId: 'cluster-123',
 *   body: {
 *     deviceIds: ['device-1', 'device-2', 'device-3'],
 *     startDate: '2026-02-06',
 *     endDate: '2026-02-06',
 *     statuses: ['IDLE', 'OFFLINE'],
 *     minDurationMinutes: 15
 *   }
 * });
 *
 * // Access data by deviceId
 * const device1Data = result.data['device-1'];
 * console.log(device1Data.periods);  // Status periods
 * console.log(device1Data.groups);   // Event groups with items
 */
export async function batchReadDeviceStateEvents(data: BatchReadData): Promise<BatchReadResponse> {
	try {
		if (!data.clusterId) {
			throw new Error("Invalid Input, clusterId is required.");
		}
		if (!data.body.deviceIds || data.body.deviceIds.length === 0) {
			throw new Error("Invalid Input, deviceIds array is required.");
		}
		if (!data.body.startDate || !data.body.endDate) {
			throw new Error("Invalid Input, startDate and endDate are required.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		if (!applicationId) {
			throw new Error("Invalid Input, APPLICATION_ID is required.");
		}

		// Construct URL: /api/cluster/application/:clusterId/state-events/:applicationId/groups/batch-read
		const url = `${data.clusterId}/state-events/${applicationId}/groups/batch-read`;

		const response = await lightHouseAPIHandler.post(url, data.body, {
			headers: {
				"x-application-secret-key": process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY!,
			},
		});

		return response.data;
	} catch (error) {
		console.error("Batch read failed:", error);
		throw error;
	}
}
