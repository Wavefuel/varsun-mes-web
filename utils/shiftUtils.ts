export type ShiftType = "Day" | "Night" | "General";
export type ShiftDisplayName = "Day Shift (S1)" | "Night Shift (S2)" | "General Shift (S3)" | "Custom";

export const SHIFT_CONFIG = {
	Day: {
		displayName: "Day Shift (S1)" as const,
		startHour: 8,
		startMinute: 0,
		endHour: 20,
		endMinute: 0,
		spansNextDay: false,
	},
	General: {
		displayName: "General Shift (S3)" as const,
		startHour: 8,
		startMinute: 30,
		endHour: 17,
		endMinute: 30,
		spansNextDay: false,
	},
	Night: {
		displayName: "Night Shift (S2)" as const,
		startHour: 20,
		startMinute: 0,
		endHour: 8,
		endMinute: 0,
		spansNextDay: true,
	},
} as const;

export function getShiftDisplayName(shift: ShiftType): ShiftDisplayName {
	return SHIFT_CONFIG[shift].displayName;
}

export function getShiftFromDisplayName(displayName: string): ShiftType | null {
	if (displayName.includes("Day Shift (S1)")) return "Day";
	if (displayName.includes("General Shift (S3)")) return "General";
	if (displayName.includes("Night Shift (S2)")) return "Night";
	return null;
}

export function buildUtcRangeFromIstDate(dateStr: string, shift: ShiftType): { fromDateUTC: Date; toDateUTC: Date } {
	const [year, month, day] = dateStr.split("-").map(Number);
	const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
	const config = SHIFT_CONFIG[shift];

	const startUTC = Date.UTC(year, month - 1, day, config.startHour, config.startMinute, 0, 0);

	const endDay = config.spansNextDay ? day + 1 : day;
	const endUTC = Date.UTC(year, month - 1, endDay, config.endHour, config.endMinute, 0, 0);

	return {
		fromDateUTC: new Date(startUTC - IST_OFFSET_MS),
		toDateUTC: new Date(endUTC - IST_OFFSET_MS),
	};
}
