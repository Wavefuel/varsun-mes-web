"use client";

import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ReasonCodeSelectProps {
	value: string;
	onChange: (value: string) => void;
	eventType: "Untagged" | "Offline" | "Logged" | string;
	className?: string;
}

const IDLE_CODES = ["Breakdown", "No Operator", "No Work / Material", "Tool Change", "Operator Break", "Machine Setup", "Quality Check"];

const OFFLINE_CODES = ["Power Loss", "MCB Trip", "Sensor Failure", "Network Issue", "Emergency Stop"];

const getCategoryForReasonCode = (reasonCode: string) => {
	const normalized = reasonCode.trim();
	if (IDLE_CODES.includes(normalized)) {
		switch (normalized) {
			case "Breakdown":
				return "OUTAGE";
			case "No Operator":
				return "PRODUCTION_SETUP";
			case "No Work / Material":
				return "MATERIAL_LOADING";
			case "Tool Change":
				return "TOOL_CHANGE";
			case "Operator Break":
				return "PRODUCTION_SETUP";
			case "Machine Setup":
				return "EQUIPMENT_SETUP";
			case "Quality Check":
				return "QUALITY_CHECK";
			default:
				return "MAINTENANCE";
		}
	}

	if (OFFLINE_CODES.includes(normalized)) {
		switch (normalized) {
			case "Power Loss":
				return "POWER";
			case "MCB Trip":
				return "POWER";
			case "Sensor Failure":
				return "ANOMALY";
			case "Network Issue":
				return "CONNECTIVITY";
			case "Emergency Stop":
				return "SAFETY";
			default:
				return "OUTAGE";
		}
	}

	return "OTHER";
};

const getDisplayLabel = (code: string) => `${code} - ${getCategoryForReasonCode(code)}`;

export function ReasonCodeSelect({ value, onChange, eventType, className }: ReasonCodeSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Determine which codes to show based on event type
	const isOffline = eventType === "Offline";
	const codes = isOffline ? OFFLINE_CODES : IDLE_CODES;
	const categoryLabel = isOffline ? "Offline Codes" : "Idle Codes";

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
					{value ? getDisplayLabel(value) : "Select a reason..."}
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
								key={code}
								type="button"
								onClick={() => handleSelect(code)}
								className={cn(
									"w-full text-left px-3 py-2 text-xs font-bold text-gray-700 rounded-md transition-colors hover:bg-gray-50",
									value === code && "bg-primary/5 text-primary",
								)}
							>
								{getDisplayLabel(code)}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
