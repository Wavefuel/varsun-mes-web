"use client";

import React from "react";
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
	const date = propDate ?? data.currentDate;
	const setDate = propSetDate ?? data.setCurrentDate;
	const shift = propShift ?? data.currentShift;
	const setShift = propSetShift ?? data.setCurrentShift;

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
		if (shift === "Night") {
			setShift("Day");
		} else {
			const d = new Date(date);
			d.setDate(d.getDate() - 1);
			setDate(d.toISOString().split("T")[0]);
			setShift("Night");
		}
	};

	const handleNextDate = () => {
		if (shift === "Day") {
			setShift("Night");
		} else {
			const d = new Date(date);
			d.setDate(d.getDate() + 1);
			setDate(d.toISOString().split("T")[0]);
			setShift("Day");
		}
	};

	return (
		<div className={cn("flex items-center justify-between py-1 px-1 gap-2", className)}>
			{/* Left: Date Picker */}
			<div className="flex items-center gap-2">
				<CustomDatePicker
					value={date}
					onChange={setDate}
					currentShift={shift}
					onShiftChange={setShift}
					disabled={disabled}
					customInput={
						<button
							disabled={disabled}
							className="flex items-center gap-1.5 bg-white border border-card-border card-shadow rounded-lg py-1.5 px-3 transition-all active:scale-95 text-primary hover:border-primary/30"
						>
							<span className="material-symbols-outlined !text-sm text-primary">calendar_today</span>
							<span className="text-xs font-bold text-primary uppercase tracking-wider">
								{getDisplayDate(date)} - {shift === "Day" ? "DAY SHIFT" : "NIGHT SHIFT"}
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
