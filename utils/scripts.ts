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

export interface CreateDeviceStateEventGroupData {
	deviceId: string;
	clusterId: string;
	applicationId?: string;
	account: Account;
	body: {
		rangeStart?: Date | string;
		rangeEnd?: Date | string;
		date?: Date | string;
		title?: string | null;
		description?: string | null;
		notes?: string | null;
		metadata?: JsonValue;
		tags?: string[] | null;
		items: DeviceStateEventItemInput[];
	};
}

/**
 * Creates a Device State Event Group along with its items in a single API call.
 * Items are created within the same transaction as the group.
 *
 * @param data - The data required to create the group and items
 * @returns The created group with its items
 *
 * @example
 * const result = await createDeviceStateEventGroup({
 *   deviceId: "device-123",
 *   clusterId: "cluster-456",
 *   account: userAccount,
 *   body: {
 *     rangeStart: "2025-01-01T00:00:00Z",
 *     rangeEnd: "2025-01-02T00:00:00Z",
 *     title: "Downtime Event",
 *     description: "Device was offline",
 *     tags: ["downtime", "maintenance"],
 *     items: [
 *       {
 *         segmentStart: "2025-01-01T08:00:00Z",
 *         segmentEnd: "2025-01-01T12:00:00Z",
 *         category: "OFFLINE",
 *         scopeType: "DEVICE_STATUS",
 *         notes: "Scheduled maintenance"
 *       }
 *     ]
 *   }
 * });
 */
export async function createDeviceStateEventGroup(data: CreateDeviceStateEventGroupData) {
	try {
		if (!data.deviceId) {
			throw new Error("Invalid Input, deviceId is required.");
		}
		if (!data.clusterId) {
			throw new Error("Invalid Input, clusterId is required.");
		}
		if (!data.account) {
			throw new Error("Invalid Input, account is required.");
		}
		if (!data.body) {
			throw new Error("Invalid Input, body is required.");
		}
		if (!data.body.items || data.body.items.length === 0) {
			throw new Error("Invalid Input, items array is required and cannot be empty.");
		}

		const range =
			data.body.date !== undefined
				? buildDayRange(data.body.date)
				: data.body.rangeStart && data.body.rangeEnd
					? {
						rangeStart: formatRangeValue(data.body.rangeStart),
						rangeEnd: formatRangeValue(data.body.rangeEnd),
					}
					: null;
		if (!range) {
			throw new Error("Invalid Input, rangeStart/rangeEnd or date is required.");
		}

		const baseDate = data.body.date ?? data.body.rangeStart;
		const normalizedItems = data.body.items.map((item) => {
			const segmentStart = resolveDateTimeValue(item.startTime ?? item.segmentStart, baseDate);
			const segmentEnd = resolveDateTimeValue(item.endTime ?? item.segmentEnd, baseDate);
			if (!segmentStart || !segmentEnd) {
				throw new Error("Invalid Input, segmentStart and segmentEnd are required.");
			}
			return normalizeCreateItemPayload({
				...item,
				segmentStart,
				segmentEnd,
				startTime: undefined,
				endTime: undefined,
			});
		});

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const deviceStateEventsUrl = `${data.clusterId}/device/${applicationId}/state-events/${data.deviceId}`;
		const rangeStartLabel = formatDateOnly(range.rangeStart);
		const rangeEndLabel = formatDateOnly(range.rangeEnd);
		const autoTitle = rangeStartLabel === rangeEndLabel ? rangeStartLabel : `${rangeStartLabel}-${rangeEndLabel}`;
		const title = data.body.title && data.body.title.trim() ? data.body.title : autoTitle;

		// Create the group with items in a single API call
		const response = await lightHouseAPIHandler.post(`${deviceStateEventsUrl}/groups/create/one`, {
			rangeStart: range.rangeStart,
			rangeEnd: range.rangeEnd,
			title,
			description: data.body.description,
			notes: data.body.notes,
			metadata: data.body.metadata,
			tags: data.body.tags,
			items: normalizedItems,
		});

		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

export interface DeviceStateEventItemUpdateInput {
	id: string;
	segmentStart?: Date | string;
	segmentEnd?: Date | string;
	startTime?: Date | string;
	endTime?: Date | string;
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

export interface UpdateDeviceStateEventGroupData {
	deviceId: string;
	clusterId: string;
	applicationId?: string;
	groupId: string;
	account: Account;
	body: {
		// Group-level updates
		group?: {
			rangeStart?: Date | string;
			rangeEnd?: Date | string;
			title?: string | null;
			description?: string | null;
			notes?: string | null;
			metadata?: JsonValue;
			tags?: string[] | null;
		};
		// Item operations
		items?: {
			create?: DeviceStateEventItemInput[];
			update?: DeviceStateEventItemUpdateInput[];
			delete?: string[];
		};
	};
}

export interface DeviceSummary {
	id: string;
	deviceName?: string;
	serialNumber?: string;
	foreignId?: string;
	itemId?: string | null;
	clusterId?: string;
	projectId?: string | null;
	metadata?: JsonValue;
	connectionStatus: string;
	deviceStatus: string;
	createdAt: string;
	updatedAt: string;
}

const formatRangeValue = (value: Date | string): string => (value instanceof Date ? value.toISOString() : String(value));

const formatDateOnly = (value: Date | string): string => {
	const parsed = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return String(value).split("T")[0];
	}
	return parsed.toISOString().split("T")[0];
};

const pickDefined = (input: Record<string, unknown>) => Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));

const parseDateValue = (value: Date | string) => {
	if (value instanceof Date) {
		const parsed = new Date(value.getTime());
		if (Number.isNaN(parsed.getTime())) throw new Error("Invalid Input, date value is invalid.");
		return parsed;
	}

	// Treat YYYY-MM-DD as a LOCAL calendar date (so day range becomes local 00:00 → 23:59)
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (m) {
		const year = Number(m[1]);
		const month = Number(m[2]) - 1;
		const day = Number(m[3]);
		const parsed = new Date(year, month, day, 0, 0, 0, 0);
		if (Number.isNaN(parsed.getTime())) throw new Error("Invalid Input, date value is invalid.");
		return parsed;
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		throw new Error("Invalid Input, date value is invalid.");
	}
	return parsed;
};

const buildDayRange = (value: Date | string) => {
	const date = parseDateValue(value);
	const rangeStart = new Date(date);
	rangeStart.setHours(0, 0, 0, 0);
	const rangeEnd = new Date(date);
	rangeEnd.setHours(23, 59, 59, 999);
	return {
		rangeStart: rangeStart.toISOString(),
		rangeEnd: rangeEnd.toISOString(),
	};
};

const isTimeOnlyString = (value: string) => /^\d{1,2}:\d{2}$/.test(value);

const buildDateTimeFromDateAndTime = (dateValue: Date | string, timeValue: string) => {
	const base = parseDateValue(dateValue);
	const [hours, minutes] = timeValue.split(":").map((part) => Number(part));
	const result = new Date(base);
	result.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
	return result.toISOString();
};

const resolveDateTimeValue = (value: Date | string | undefined, dateValue?: Date | string) => {
	if (value === undefined) return undefined;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string" && isTimeOnlyString(value)) {
		if (!dateValue) {
			throw new Error("Invalid Input, date is required for time-only values.");
		}
		return buildDateTimeFromDateAndTime(dateValue, value);
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return String(value);
	return parsed.toISOString();
};

const buildItemMetadata = (input: {
	metadata?: JsonValue;
	operatorCode?: string | null;
	partNumber?: string | null;
	workOrder?: string | null;
	opBatchQty?: number | null;
	estPartAdd?: string | number | null;
}) => {
	const base =
		input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
			? { ...(input.metadata as Record<string, JsonValue>) }
			: {};
	const extra = pickDefined({
		operatorCode: input.operatorCode,
		partNumber: input.partNumber,
		workOrder: input.workOrder,
		opBatchQty: input.opBatchQty,
		estPartAdd: input.estPartAdd,
	});
	const merged = { ...base, ...extra };
	return Object.keys(merged).length ? merged : undefined;
};

const normalizeCreateItemPayload = (item: DeviceStateEventItemInput) =>
	pickDefined({
		segmentStart: item.startTime ?? item.segmentStart,
		segmentEnd: item.endTime ?? item.segmentEnd,
		state: item.state,
		category: item.category,
		impact: item.impact,
		scopeType: item.scopeType,
		scopeKey: item.scopeKey,
		notes: item.notes,
		metadata: buildItemMetadata(item),
	});

const normalizeUpdateItemPayload = (item: DeviceStateEventItemUpdateInput) => ({
	id: item.id,
	...pickDefined({
		segmentStart: item.startTime ?? item.segmentStart,
		segmentEnd: item.endTime ?? item.segmentEnd,
		category: item.category,
		impact: item.impact,
		scopeType: item.scopeType,
		scopeKey: item.scopeKey,
		notes: item.notes,
		metadata: buildItemMetadata(item),
	}),
});

/**
 * Updates a Device State Event Group and its items.
 * Supports updating group properties, creating new items, updating existing items, and deleting items.
 *
 * @param data - The data required to update the group and items
 * @returns The updated group
 *
 * @example
 * const result = await updateDeviceStateEventGroup({
 *   deviceId: "device-123",
 *   clusterId: "cluster-456",
 *   groupId: "group-789",
 *   account: userAccount,
 *   body: {
 *     group: {
 *       title: "Updated Title",
 *       description: "Updated description"
 *     },
 *     items: {
 *       create: [
 *         {
 *           segmentStart: "2025-01-01T14:00:00Z",
 *           segmentEnd: "2025-01-01T16:00:00Z",
 *           category: "MAINTENANCE",
 *           scopeType: "DEVICE_STATUS"
 *         }
 *       ],
 *       update: [
 *         {
 *           id: "item-123",
 *           notes: "Updated notes"
 *         }
 *       ],
 *       delete: ["item-456"]
 *     }
 *   }
 * });
 */
export async function updateDeviceStateEventGroup(data: UpdateDeviceStateEventGroupData) {
	try {
		if (!data.deviceId) {
			throw new Error("Invalid Input, deviceId is required.");
		}
		if (!data.clusterId) {
			throw new Error("Invalid Input, clusterId is required.");
		}
		if (!data.groupId) {
			throw new Error("Invalid Input, groupId is required.");
		}
		if (!data.account) {
			throw new Error("Invalid Input, account is required.");
		}
		if (!data.body) {
			throw new Error("Invalid Input, body is required.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const deviceStateEventsUrl = `${data.clusterId}/device/${applicationId}/state-events/${data.deviceId}`;

		const response = await lightHouseAPIHandler.patch(
			`${deviceStateEventsUrl}/groups/update/one/${data.groupId}`,
			{
				group: data.body.group,
				items: data.body.items
					? {
						create: Array.isArray(data.body.items.create) ? data.body.items.create.map(normalizeCreateItemPayload) : undefined,
						update: Array.isArray(data.body.items.update) ? data.body.items.update.map(normalizeUpdateItemPayload) : undefined,
						delete: Array.isArray(data.body.items.delete) ? data.body.items.delete : undefined,
					}
					: undefined,
			},
			{
				headers: {
					"x-application-secret-key": process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY!,
				},
			},
		);

		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

interface UpdateDeviceStateEventGroupItemsBaseData {
	deviceId: string;
	clusterId: string;
	applicationId?: string;
	groupId: string;
	account: Account;
}

interface CreateDeviceStateEventGroupItemsData extends UpdateDeviceStateEventGroupItemsBaseData {
	items: DeviceStateEventItemInput[];
}

/**
 * Creates items within an existing Device State Event Group.
 *
 * @param data - The data required to create items
 * @returns The updated group
 */
export async function createDeviceStateEventGroupItems(data: CreateDeviceStateEventGroupItemsData) {
	try {
		if (!data.deviceId) throw new Error("Invalid Input, deviceId is required.");
		if (!data.clusterId) throw new Error("Invalid Input, clusterId is required.");
		if (!data.groupId) throw new Error("Invalid Input, groupId is required.");
		if (!data.account) throw new Error("Invalid Input, account is required.");
		if (!data.items || data.items.length === 0) {
			throw new Error("Invalid Input, items array is required and cannot be empty.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const deviceStateEventsUrl = `${data.clusterId}/device/${applicationId}/state-events/${data.deviceId}`;

		const response = await lightHouseAPIHandler.patch(
			`${deviceStateEventsUrl}/groups/update/one/${data.groupId}`,
			{
				items: { create: data.items.map(normalizeCreateItemPayload) },
			},
			{
				headers: {
					"x-application-secret-key": process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY!,
				},
			},
		);

		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

interface UpdateDeviceStateEventGroupItemsData extends UpdateDeviceStateEventGroupItemsBaseData {
	items: DeviceStateEventItemUpdateInput[];
}

/**
 * Updates items within an existing Device State Event Group.
 *
 * @param data - The data required to update items
 * @returns The updated group
 */
export async function updateDeviceStateEventGroupItems(data: UpdateDeviceStateEventGroupItemsData) {
	try {
		if (!data.deviceId) throw new Error("Invalid Input, deviceId is required.");
		if (!data.clusterId) throw new Error("Invalid Input, clusterId is required.");
		if (!data.groupId) throw new Error("Invalid Input, groupId is required.");
		if (!data.account) throw new Error("Invalid Input, account is required.");
		if (!data.items || data.items.length === 0) {
			throw new Error("Invalid Input, items array is required and cannot be empty.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const deviceStateEventsUrl = `${data.clusterId}/device/${applicationId}/state-events/${data.deviceId}`;

		const response = await lightHouseAPIHandler.patch(
			`${deviceStateEventsUrl}/groups/update/one/${data.groupId}`,
			{
				items: { update: data.items.map(normalizeUpdateItemPayload) },
			},
			{
				headers: {
					"x-application-secret-key": process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY!,
				},
			},
		);

		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

interface DeleteDeviceStateEventGroupItemsData extends UpdateDeviceStateEventGroupItemsBaseData {
	itemIds: string[];
}

/**
 * Deletes items within an existing Device State Event Group.
 *
 * @param data - The data required to delete items
 * @returns The updated group
 */
export async function deleteDeviceStateEventGroupItems(data: DeleteDeviceStateEventGroupItemsData) {
	try {
		if (!data.deviceId) throw new Error("Invalid Input, deviceId is required.");
		if (!data.clusterId) throw new Error("Invalid Input, clusterId is required.");
		if (!data.groupId) throw new Error("Invalid Input, groupId is required.");
		if (!data.account) throw new Error("Invalid Input, account is required.");
		if (!data.itemIds || data.itemIds.length === 0) {
			throw new Error("Invalid Input, itemIds array is required and cannot be empty.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const deviceStateEventsUrl = `${data.clusterId}/device/${applicationId}/state-events/${data.deviceId}`;

		const response = await lightHouseAPIHandler.patch(
			`${deviceStateEventsUrl}/groups/update/one/${data.groupId}`,
			{
				items: { delete: data.itemIds },
			},
			{
				headers: {
					"x-application-secret-key": process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY!,
				},
			},
		);

		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

interface DeleteDeviceStateEventGroupItemsManyData {
	deviceId: string;
	clusterId: string;
	applicationId?: string;
	account: Account;
	itemIds: string[];
}

/**
 * Deletes multiple items from any Device State Event Group.
 *
 * @param data - The data required to delete items
 * @returns The deletion result
 */
export async function deleteDeviceStateEventGroupItemsMany(data: DeleteDeviceStateEventGroupItemsManyData) {
	try {
		if (!data.deviceId) throw new Error("Invalid Input, deviceId is required.");
		if (!data.clusterId) throw new Error("Invalid Input, clusterId is required.");
		if (!data.account) throw new Error("Invalid Input, account is required.");
		if (!data.itemIds || data.itemIds.length === 0) {
			throw new Error("Invalid Input, itemIds array is required and cannot be empty.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const deviceStateEventsUrl = `${data.clusterId}/device/${applicationId}/state-events/${data.deviceId}`;

		const response = await lightHouseAPIHandler.delete(`${deviceStateEventsUrl}/groups/items/delete/many`, {
			data: { itemIds: data.itemIds },
			headers: {
				"x-application-secret-key": process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY!,
			},
		});

		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

export interface DeleteDeviceStateEventGroupItemsManyByClusterData {
	clusterId: string;
	applicationId?: string;
	account: Account;
	items: { deviceId: string; itemId: string }[];
}

/**
 * Deletes multiple items from any Device State Event Group across multiple devices.
 */
export async function deleteDeviceStateEventGroupItemsManyByCluster(data: DeleteDeviceStateEventGroupItemsManyByClusterData) {
	try {
		if (!data.clusterId) throw new Error("Invalid Input, clusterId is required.");
		if (!data.account) throw new Error("Invalid Input, account is required.");
		if (!data.items || data.items.length === 0) {
			throw new Error("Invalid Input, items array is required and cannot be empty.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		// Use a cluster-level endpoint for bulk deletion across devices
		const url = `${data.clusterId}/device/${applicationId}/groups/items/delete/many`;

		const response = await lightHouseAPIHandler.delete(url, {
			data: { items: data.items },
			headers: {
				"x-application-secret-key": process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY!,
			},
		});

		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

interface DeleteDeviceStateEventGroupData {
	deviceId: string;
	clusterId: string;
	applicationId?: string;
	groupId: string;
	account: Account;
}

/**
 * Deletes a Device State Event Group and all its items.
 *
 * @param data - The data required to delete the group
 * @returns The deletion result
 *
 * @example
 * const result = await deleteDeviceStateEventGroup({
 *   deviceId: "device-123",
 *   clusterId: "cluster-456",
 *   groupId: "group-789",
 *   account: userAccount
 * });
 */
export async function deleteDeviceStateEventGroup(data: DeleteDeviceStateEventGroupData) {
	try {
		if (!data.deviceId) {
			throw new Error("Invalid Input, deviceId is required.");
		}
		if (!data.clusterId) {
			throw new Error("Invalid Input, clusterId is required.");
		}
		if (!data.groupId) {
			throw new Error("Invalid Input, groupId is required.");
		}
		if (!data.account) {
			throw new Error("Invalid Input, account is required.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const deviceStateEventsUrl = `${data.clusterId}/device/${applicationId}/state-events/${data.deviceId}`;

		const response = await lightHouseAPIHandler.delete(`${deviceStateEventsUrl}/groups/delete/one/${data.groupId}`, {
			headers: {
				"x-application-secret-key": process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY!,
			},
		});

		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

interface ReadDeviceStateEventGroupsWithItemsData {
	deviceId: string;
	clusterId: string;
	applicationId?: string;
	account: Account;
	query: {
		rangeStart: Date | string;
		rangeEnd: Date | string;
	};
}

/**
 * Reads Device State Event Groups with their items for a given date range.
 * Returns multiple groups if they exist within the specified range.
 *
 * @param data - The data required to read groups
 * @returns The groups with their items
 *
 * @example
 * const result = await readDeviceStateEventGroupsWithItems({
 *   deviceId: "device-123",
 *   clusterId: "cluster-456",
 *   account: userAccount,
 *   query: {
 *     rangeStart: "2025-01-01T00:00:00Z",
 *     rangeEnd: "2025-01-02T00:00:00Z"
 *   }
 * });
 */
export async function readDeviceStateEventGroupsWithItems(data: ReadDeviceStateEventGroupsWithItemsData) {
	try {
		if (!data.deviceId) {
			throw new Error("Invalid Input, deviceId is required.");
		}
		if (!data.clusterId) {
			throw new Error("Invalid Input, clusterId is required.");
		}
		if (!data.account) {
			throw new Error("Invalid Input, account is required.");
		}
		if (!data.query?.rangeStart || !data.query?.rangeEnd) {
			throw new Error("Invalid Input, rangeStart and rangeEnd are required.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const deviceStateEventsUrl = `${data.clusterId}/device/${applicationId}/state-events/${data.deviceId}`;

		const response = await lightHouseAPIHandler.get(`${deviceStateEventsUrl}/groups/read/many/with-items`, {
			params: {
				rangeStart: data.query.rangeStart,
				rangeEnd: data.query.rangeEnd,
			},
		});

		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

export interface ReadDeviceStateEventGroupsWithItemsByClusterData {
	clusterId: string;
	applicationId?: string;
	account: Account;
	query: {
		rangeStart: Date | string;
		rangeEnd: Date | string;
	};
	deviceId?: string;
}

/**
 * Reads Device State Event Groups with their items across ALL devices in a cluster for a given date range.
 */
export async function readDeviceStateEventGroupsWithItemsByCluster(data: ReadDeviceStateEventGroupsWithItemsByClusterData) {
	try {
		if (!data.clusterId) {
			throw new Error("Invalid Input, clusterId is required.");
		}
		if (!data.account) {
			throw new Error("Invalid Input, account is required.");
		}
		if (!data.query?.rangeStart || !data.query?.rangeEnd) {
			throw new Error("Invalid Input, rangeStart and rangeEnd are required.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const response = await lightHouseAPIHandler.get(`${data.clusterId}/device/${applicationId}/groups/read/many/with-items`, {
			params: {
				rangeStart: data.query.rangeStart,
				rangeEnd: data.query.rangeEnd,
				...(data.deviceId ? { deviceId: data.deviceId } : {}),
			},
		});
		return response.data?.data;
	} catch (error) {
		throw error;
	}
}

export interface ReadDeviceStateEventItemsByDateData {
	deviceId: string;
	clusterId: string;
	applicationId?: string;
	account: Account;
	date: Date | string;
}

export async function readDeviceStateEventItemsByDate(data: ReadDeviceStateEventItemsByDateData) {
	const range = buildDayRange(data.date);
	const groups = await readDeviceStateEventGroupsWithItems({
		deviceId: data.deviceId,
		clusterId: data.clusterId,
		applicationId: data.applicationId,
		account: data.account,
		query: {
			rangeStart: range.rangeStart,
			rangeEnd: range.rangeEnd,
		},
	});

	const items = Array.isArray(groups)
		? (groups as unknown[]).flatMap((groupUnknown) => {
			const group = (groupUnknown && typeof groupUnknown === "object" ? (groupUnknown as Record<string, unknown>) : {}) as Record<
				string,
				unknown
			>;
			const groupItems = Array.isArray(group?.Items) ? (group.Items as unknown[]) : [];
			const groupId = group.id;
			const groupTitle = group.title;
			return groupItems.map((itemUnknown) => ({
				...(itemUnknown && typeof itemUnknown === "object" ? (itemUnknown as Record<string, unknown>) : {}),
				groupId,
				groupTitle,
			}));
		})
		: [];

	return items;
}

export interface FetchDeviceListData {
	clusterId: string;
	query?: {
		page?: number;
		limit?: number;
		search?: string;
		searchKeys?: string;
		projectId?: string;
		itemId?: string;
	};
}

export async function fetchDeviceList(data: FetchDeviceListData): Promise<DeviceSummary[]> {
	try {
		if (!data.clusterId) {
			throw new Error("Invalid Input, clusterId is required.");
		}

		const applicationId = process.env.NEXT_PUBLIC_APPLICATION_ID;
		if (!applicationId) {
			throw new Error("Invalid Input, APPLICATION_ID is required.");
		}

		const response = await lightHouseAPIHandler.post(`${data.clusterId}/device/${applicationId}/read/many`, {
			where: {
				clusterId: data.clusterId,
			},
			select: {
				id: true,
				deviceName: true,
				serialNumber: true,
				foreignId: true,
				itemId: true,
				connectionStatus: true,
				deviceStatus: true,
				createdAt: true,
				updatedAt: true,
			},
			...(data.query?.page &&
				data.query?.limit && {
				skip: (data.query.page - 1) * data.query.limit,
				take: data.query.limit,
			}),
		});

		return response.data?.data ?? [];
	} catch (error) {
		throw error;
	}
}

export interface FetchDeviceStatusPeriodsData {
	deviceId: string;
	clusterId: string;
	applicationId?: string;
	query?: {
		deviceStatus?: string;
		reasonCode?: string;
		fromDate?: Date | string;
		toDate?: Date | string;
		minDurationMinutes?: number;
	};
}

export interface DeviceStatusPeriod {
	status: string;
	startTime: string;
	endTime: string;
	durationSeconds: number;
	durationMinutes: number;
	isOngoing: boolean;
}

export interface FetchDeviceStatusPeriodsResponse {
	data: DeviceStatusPeriod[];
	totalPeriods: number;
	queryParams: {
		deviceStatus: string | null;
		fromDate: string;
		toDate: string;
		minDurationMinutes: number;
	};
}

/**
 * Fetches device status periods that meet a minimum duration threshold.
 * Returns all device states or a specific state if deviceStatus is provided.
 *
 * @param data - The data required to fetch status periods
 * @returns Device status periods with duration information
 *
 * @example
 * // Get all states >= 15 mins for today
 * const result = await fetchDeviceStatusPeriods({
 *   deviceId: "device-123",
 *   clusterId: "cluster-456"
 * });
 *
 * // Get IDLE periods >= 20 mins for a specific date range
 * const result = await fetchDeviceStatusPeriods({
 *   deviceId: "device-123",
 *   clusterId: "cluster-456",
 *   query: {
 *     deviceStatus: "IDLE",
 *     fromDate: "2025-01-01T00:00:00Z",
 *     toDate: "2025-01-02T00:00:00Z",
 *     minDurationMinutes: 20
 *   }
 * });
 */
export async function fetchDeviceStatusPeriods(data: FetchDeviceStatusPeriodsData): Promise<FetchDeviceStatusPeriodsResponse> {
	try {
		if (!data.deviceId) {
			throw new Error("Invalid Input, deviceId is required.");
		}
		if (!data.clusterId) {
			throw new Error("Invalid Input, clusterId is required.");
		}

		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		const deviceStateEventsUrl = `${data.clusterId}/device/${applicationId}/state-events/${data.deviceId}`;

		const response = await lightHouseAPIHandler.get(`${deviceStateEventsUrl}/status-periods`, {
			params: {
				...(data.query?.deviceStatus && { deviceStatus: data.query.deviceStatus }),
				...(data.query?.reasonCode && { reasonCode: data.query.reasonCode }),
				...(data.query?.fromDate && { fromDate: data.query.fromDate }),
				...(data.query?.toDate && { toDate: data.query.toDate }),
				...(data.query?.minDurationMinutes && { minDurationMinutes: data.query.minDurationMinutes }),
			},
		});

		return response.data;
	} catch (error) {
		throw error;
	}
}

/**
 * Fetches the total count of devices in the cluster.
 * Used for dashboard metrics.
 */
export async function fetchDeviceCount(data: { clusterId: string; applicationId?: string }): Promise<number> {
	try {
		const applicationId = data.applicationId || process.env.NEXT_PUBLIC_APPLICATION_ID;
		if (!applicationId) throw new Error("Invalid Input, APPLICATION_ID is required.");

		const response = await lightHouseAPIHandler.post(`${data.clusterId}/device/${applicationId}/count`, {
			where: { clusterId: data.clusterId }
		});
		return response.data?.data ?? 0;
	} catch (error) {
		console.error("Failed to fetch device count:", error);
		return 0;
	}
}
