/**
 * Date/Time utility functions for the application.
 * Provides IST (Indian Standard Time) conversion and formatting utilities.
 */

/**
 * Converts a UTC ISO date string to IST (Indian Standard Time) formatted string.
 * 
 * @param isoString - The ISO date string in UTC (e.g., "2026-01-19T03:30:00.000Z")
 * @returns Formatted IST string (e.g., "19 Jan 2026, 09:00 AM IST")
 * 
 * @example
 * formatToIST("2026-01-19T03:30:00.000Z") // "19 Jan 2026, 09:00 AM IST"
 * formatToIST("2026-01-19T11:30:00.000Z") // "19 Jan 2026, 05:00 PM IST"
 */
export function formatToIST(isoString: string | Date | null | undefined): string {
    if (!isoString) return "";

    const date = isoString instanceof Date ? isoString : new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";

    // Format in IST timezone
    const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    };

    const formatted = new Intl.DateTimeFormat("en-IN", options).format(date);
    return `${formatted} IST`;
}

/**
 * Converts a UTC ISO date string to IST time only (HH:MM AM/PM format).
 * 
 * @param isoString - The ISO date string in UTC
 * @returns Formatted IST time string (e.g., "09:00 AM")
 * 
 * @example
 * formatTimeToIST("2026-01-19T03:30:00.000Z") // "09:00 AM"
 * formatTimeToIST("2026-01-19T11:30:00.000Z") // "05:00 PM"
 */
export function formatTimeToIST(isoString: string | Date | null | undefined): string {
    if (!isoString) return "";

    const date = isoString instanceof Date ? isoString : new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";

    const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    };

    return new Intl.DateTimeFormat("en-IN", options).format(date);
}

/**
 * Converts a UTC ISO date string to IST time in 24-hour HH:MM format.
 * Useful for time input fields.
 * 
 * @param isoString - The ISO date string in UTC
 * @returns Formatted IST time string in 24-hour format (e.g., "09:00")
 * 
 * @example
 * formatTimeToIST24("2026-01-19T03:30:00.000Z") // "09:00"
 * formatTimeToIST24("2026-01-19T11:30:00.000Z") // "17:00"
 */
export function formatTimeToIST24(isoString: string | Date | null | undefined): string {
    if (!isoString) return "";

    const date = isoString instanceof Date ? isoString : new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";

    const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    };

    return new Intl.DateTimeFormat("en-GB", options).format(date);
}

/**
 * Converts a UTC ISO date string to IST date only (DD Mon YYYY format).
 * 
 * @param isoString - The ISO date string in UTC
 * @returns Formatted IST date string (e.g., "19 Jan 2026")
 * 
 * @example
 * formatDateToIST("2026-01-19T03:30:00.000Z") // "19 Jan 2026"
 */
export function formatDateToIST(isoString: string | Date | null | undefined): string {
    if (!isoString) return "";

    const date = isoString instanceof Date ? isoString : new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";

    const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
    };

    return new Intl.DateTimeFormat("en-IN", options).format(date);
}

/**
 * Gets the IST Date object from a UTC ISO string.
 * Creates a new Date adjusted to IST (+5:30).
 * 
 * @param isoString - The ISO date string in UTC
 * @returns Date object representing the same moment in IST
 */
export function getISTDate(isoString: string | Date | null | undefined): Date | null {
    if (!isoString) return null;

    const date = isoString instanceof Date ? isoString : new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;

    // IST is UTC+5:30
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    return new Date(date.getTime() + istOffsetMs);
}

/**
 * Extracts hour and minute components from a UTC ISO string in IST.
 * 
 * @param isoString - The ISO date string in UTC
 * @returns Object with hours (0-23) and minutes (0-59) in IST, or null if invalid
 * 
 * @example
 * getISTTimeComponents("2026-01-19T03:30:00.000Z") // { hours: 9, minutes: 0 }
 */
export function getISTTimeComponents(isoString: string | Date | null | undefined): { hours: number; minutes: number } | null {
    if (!isoString) return null;

    const date = isoString instanceof Date ? isoString : new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;

    // Get the IST time string and parse it
    const timeStr = formatTimeToIST24(date);
    const [hours, minutes] = timeStr.split(":").map(Number);

    return { hours, minutes };
}

/**
 * Combines a date string and a time string (interpreted as IST) into a UTC ISO string.
 * This is effectively the reverse of formatting to IST.
 * 
 * @param dateStr - Date string (ISO or YYYY-MM-DD or MM/DD/YYYY)
 * @param timeStr - Time string (HH:MM or HH:MM:SS) in IST
 * @returns ISO string in UTC representing the given IST time
 * 
 * @example
 * combineISTDateAndTime("2026-01-19", "09:00") // Returns timestamp for 03:30 UTC
 */
export function combineISTDateAndTime(dateStr: string, timeStr: string): string | undefined {
    if (!dateStr || !timeStr) return undefined;

    let date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return undefined;

    const [hours, minutes] = timeStr.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;

    // If dateStr is YYYY-MM-DD, parsing usually yields UTC midnight. 
    // Make sure we have the correct Year/Month/Day components.
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    // Construct a UTC time that matches the IST visual components.
    // For example, if we want 09:00 IST, we make a UTC date for 09:00.
    const utcAsIst = Date.UTC(year, month, day, hours, minutes, 0, 0);

    // IST is UTC + 5:30.
    // So actual UTC = (UTC timestamp of 09:00) - 5h 30m
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const realUtcTimestamp = utcAsIst - istOffsetMs;

    return new Date(realUtcTimestamp).toISOString();
}
