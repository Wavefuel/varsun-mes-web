"use client";

import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ReasonCodeSelectProps {
	value: string;
	onChange: (value: string) => void;
	eventType: "Untagged" | "Offline" | "Logged" | string;
	className?: string;
}

export type ReasonCodeEntry = {
	code: string;
	description: string;
	category: string;
};

export const IDLE_REASON_CODES: ReasonCodeEntry[] = [
	{ code: "11", description: "No Power", category: "OUTAGE" },
	{ code: "12", description: "MCB Fault", category: "OUTAGE" },
	{ code: "13", description: "Sensor Fault", category: "CALIBRATION" },
	{ code: "14", description: "Breakdown", category: "OUTAGE" },
	{ code: "19", description: "Other", category: "OTHER" },
];

export const OFFLINE_REASON_CODES: ReasonCodeEntry[] = [
	{ code: "21", description: "Breakdown", category: "OUTAGE" },
	{ code: "22", description: "No Operator", category: "LABOR_UNAVAILABLE" },
	{ code: "23", description: "No Work", category: "WORK_UNAVAILABLE" },
	{ code: "24", description: "No Feed", category: "MATERIAL_SHORTAGE" },
	{ code: "25", description: "In Setting", category: "PRODUCTION_SETUP" },
	{ code: "26", description: "Under Inspection", category: "QUALITY_CHECK" },
	{ code: "27", description: "Waiting for Inspector", category: "QUALITY_CHECK" },
	{ code: "29", description: "Other", category: "OTHER" },
];

export const ONLINE_REASON_CODES: ReasonCodeEntry[] = [
	{ code: "31", description: "Load", category: "PRODUCTION_RUN" },
	{ code: "32", description: "No Load", category: "PERFORMANCE" },
	{ code: "33", description: "High Speed", category: "PERFORMANCE" },
	{ code: "34", description: "Low Speed", category: "PERFORMANCE" },
];

export const UNAVAILABLE_REASON_CODES: ReasonCodeEntry[] = [
	{ code: "11", description: "No Power", category: "OUTAGE" },
];

const REASON_CODE_MAP: Record<string, ReasonCodeEntry> = [
	...OFFLINE_REASON_CODES,
	...IDLE_REASON_CODES,
	...ONLINE_REASON_CODES,
	...UNAVAILABLE_REASON_CODES,
].reduce(
	(acc, entry) => {
		acc[entry.code] = entry;
		return acc;
	},
	{} as Record<string, ReasonCodeEntry>,
);

export const getReasonCategory = (reasonCode: string) => REASON_CODE_MAP[reasonCode]?.category ?? "OTHER";

export const getReasonDescription = (reasonCode: string) => REASON_CODE_MAP[reasonCode]?.description ?? "";

export const getReasonLabel = (reasonCode: string) => {
	const entry = REASON_CODE_MAP[reasonCode];
	return entry ? `${entry.code} - ${entry.description} - ${entry.category}` : reasonCode;
};

export function ReasonCodeSelect({ value, onChange, eventType, className }: ReasonCodeSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Determine which codes to show based on event type
	const normalizedType = String(eventType).toLowerCase();
	const isOffline = normalizedType === "offline";
	const isIdle = normalizedType === "idle" || normalizedType === "standby";
	const isRunning = normalizedType === "running" || normalizedType === "active";
	const isUnavailable = normalizedType === "unavailable";
	const codes = isOffline
		? OFFLINE_REASON_CODES
		: isIdle
			? IDLE_REASON_CODES
			: isRunning
				? ONLINE_REASON_CODES
				: isUnavailable
					? UNAVAILABLE_REASON_CODES
					: IDLE_REASON_CODES;
	const categoryLabel = isOffline
		? "Offline Codes"
		: isIdle
			? "Idle Codes"
			: isRunning
				? "Online Codes"
				: isUnavailable
					? "Unavailable"
					: "Idle Codes";

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelect = (code: string) => {
		onChange(code);
		setIsOpen(false);
	};

	return (
		<div className={cn("relative", className)} ref={containerRef}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={cn(
					"w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
					isOpen && "border-primary ring-2 ring-primary/20",
				)}
			>
				<span className={cn("truncate", !value && "text-gray-400 font-medium")}>
					{value ? getReasonLabel(value) : "Select a reason..."}
				</span>
				<span
					className={cn("material-symbols-outlined text-gray-400 !text-[18px] transition-transform duration-200", isOpen && "rotate-180")}
				>
					keyboard_arrow_down
				</span>
			</button>

			{isOpen && (
				<div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
					<div className="px-3 py-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider bg-gray-50/50">{categoryLabel}</div>
					<div className="p-1.5 space-y-0.5">
						{codes.map((code) => (
							<button
								key={code.code}
								type="button"
								onClick={() => handleSelect(code.code)}
								className={cn(
									"w-full text-left px-3 py-2 text-xs font-bold text-gray-700 rounded-md transition-colors hover:bg-gray-50",
									value === code.code && "bg-primary/5 text-primary",
								)}
							>
								{getReasonLabel(code.code)}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
