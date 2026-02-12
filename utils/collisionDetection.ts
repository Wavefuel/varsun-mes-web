/**
 * Collision Detection Utilities for ERP Sync
 * Handles time overlap detection and available slot calculation
 */

export type CollisionType = "FULL_SHIFT" | "PARTIAL_OVERLAP" | "ERP_COLLISION" | "INVALID_DURATION";

export interface CollisionInfo {
	type: CollisionType;
	message: string;
	availableSlots?: { start: string; end: string }[];
}

/**
 * Parse duration from various formats (minutes, ISO 8601, etc.)
 * @returns Duration in minutes, or null if invalid
 */
export function parseDuration(duration: any): number | null {
	if (!duration) return null;

	// If it's a number, assume it's in minutes
	if (typeof duration === "number") return duration;

	const str = String(duration).trim();

	// Try parsing as plain number (minutes)
	const numValue = parseFloat(str);
	if (!isNaN(numValue)) return numValue;

	// Try parsing ISO 8601 duration format (PT2H30M)
	const iso8601Match = str.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
	if (iso8601Match) {
		const hours = parseInt(iso8601Match[1] || "0");
		const minutes = parseInt(iso8601Match[2] || "0");
		const seconds = parseInt(iso8601Match[3] || "0");
		return hours * 60 + minutes + Math.floor(seconds / 60);
	}

	return null;
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
	return start1 < end2 && start2 < end1;
}

/**
 * Find available time slots in a shift given existing plans
 */
export function findAvailableSlots(
	shiftStartMs: number,
	shiftEndMs: number,
	existingPlans: { start: number; end: number }[],
	requiredDurationMinutes: number,
): { start: string; end: string }[] {
	const requiredDurationMs = requiredDurationMinutes * 60 * 1000;
	const slots: { start: string; end: string }[] = [];

	// Sort existing plans by start time
	const sortedPlans = [...existingPlans].sort((a, b) => a.start - b.start);

	let currentTime = shiftStartMs;

	for (const plan of sortedPlans) {
		// Check if there's a gap before this plan
		const gapDuration = plan.start - currentTime;
		if (gapDuration >= requiredDurationMs) {
			slots.push({
				start: new Date(currentTime).toISOString(),
				end: new Date(plan.start).toISOString(),
			});
		}
		currentTime = Math.max(currentTime, plan.end);
	}

	// Check if there's a gap after the last plan
	const finalGap = shiftEndMs - currentTime;
	if (finalGap >= requiredDurationMs) {
		slots.push({
			start: new Date(currentTime).toISOString(),
			end: new Date(shiftEndMs).toISOString(),
		});
	}

	return slots;
}

/**
 * Format ISO time string to readable time
 */
export function formatTimeSlot(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});
}
