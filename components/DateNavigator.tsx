"use client";

import React, { useState, useEffect, useRef } from "react";
import CustomDatePicker from "./CustomDatePicker";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useData } from "@/context/DataContext";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

interface DateNavigatorProps {
	currentDate?: string;
	setCurrentDate?: (date: string) => void;
	currentShift?: "Day" | "Night";
	setCurrentShift?: (shift: "Day" | "Night") => void;
	disabled?: boolean;
	className?: string;
}

export default function DateNavigator({
	currentDate: propDate,
	setCurrentDate: propSetDate,
	currentShift: propShift,
	setCurrentShift: propSetShift,
	disabled,
	className,
}: DateNavigatorProps) {
	const data = useData();

	// Support both prop-driven and context-driven usage
	const derivedDate = propDate ?? data.currentDate;
	const derivedSetDate = propSetDate ?? data.setCurrentDate;
	const derivedShift = propShift ?? data.currentShift;
	const derivedSetShift = propSetShift ?? data.setCurrentShift;

	// Local state for immediate UI updates
	const [localDate, setLocalDate] = useState(derivedDate);
	const [localShift, setLocalShift] = useState(derivedShift);
	const timeoutRef = useRef<any>(null);

	// Sync local state when external props change (unless we are driving it?)
	// To avoid conflict, we only sync if the values differ and we might assume external source of truth updates eventually.
	// But simply syncing is the standard pattern for "controlled component with internal buffer".
	useEffect(() => {
		setLocalDate(derivedDate);
	}, [derivedDate]);

	useEffect(() => {
		setLocalShift(derivedShift);
	}, [derivedShift]);

	const debouncedUpdate = (newDate: string, newShift: "Day" | "Night") => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			derivedSetDate?.(newDate);
			derivedSetShift?.(newShift);
		}, 600);
	};

	const updateState = (newDate: string, newShift: "Day" | "Night") => {
		setLocalDate(newDate);
		setLocalShift(newShift);
		debouncedUpdate(newDate, newShift);
	};

	const getDisplayDate = (dateStr: string) => {
		const d = new Date(dateStr);
		return d
			.toLocaleDateString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
			})
			.toUpperCase();
	};

	const handlePrevDate = () => {
		let newDate = localDate;
		let newShift = localShift;

		if (localShift === "Night") {
			newShift = "Day";
		} else {
			const d = new Date(localDate);
			d.setDate(d.getDate() - 1);
			newDate = d.toISOString().split("T")[0];
			newShift = "Night";
		}
		updateState(newDate, newShift);
	};

	const handleNextDate = () => {
		let newDate = localDate;
		let newShift = localShift;

		if (localShift === "Day") {
			newShift = "Night";
		} else {
			const d = new Date(localDate);
			d.setDate(d.getDate() + 1);
			newDate = d.toISOString().split("T")[0];
			newShift = "Day";
		}
		updateState(newDate, newShift);
	};

	return (
		<div className={cn("flex items-center justify-between py-1 px-1 gap-2", className)}>
			{/* Left: Date Picker */}
			<div className="flex items-center gap-2">
				<CustomDatePicker
					value={localDate}
					onChange={(d) => updateState(d, localShift)}
					currentShift={localShift}
					onShiftChange={(s) => updateState(localDate, s)}
					disabled={disabled}
					customInput={
						<button
							disabled={disabled}
							className="flex items-center gap-1.5 bg-white border border-card-border card-shadow rounded-lg py-1.5 px-3 transition-all active:scale-95 text-primary hover:border-primary/30"
						>
							<span className="material-symbols-outlined !text-sm text-primary">calendar_today</span>
							<span className="text-xs font-bold text-primary uppercase tracking-wider">
								{getDisplayDate(localDate)} - {localShift === "Day" ? "DAY SHIFT" : "NIGHT SHIFT"}
							</span>
						</button>
					}
				/>
			</div>

			{/* Right: Navigation Arrows */}
			<div className="flex items-center gap-1.5">
				<button
					onClick={handlePrevDate}
					disabled={disabled}
					className="size-7 flex items-center justify-center rounded-lg bg-white border border-card-border shadow-sm text-primary hover:text-primary hover:border-primary/50 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
				>
					<span className="material-symbols-outlined !text-lg">chevron_left</span>
				</button>
				<button
					onClick={handleNextDate}
					disabled={disabled}
					className="size-7 flex items-center justify-center rounded-lg bg-white border border-card-border shadow-sm text-primary hover:text-primary hover:border-primary/50 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
				>
					<span className="material-symbols-outlined !text-lg">chevron_right</span>
				</button>
			</div>
		</div>
	);
}
