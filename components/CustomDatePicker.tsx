import React, { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./CustomDatePicker.css";
import { format, parse, parseISO } from "date-fns";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

interface CustomDatePickerProps {
	value: string; // YYYY-MM-DD or HH:mm
	onChange: (date: string) => void;
	className?: string; // Class for the wrapper
	wrapperClassName?: string;
	customInput?: React.ReactNode;
	disabled?: boolean;
	showTimeSelect?: boolean;
	showTimeSelectOnly?: boolean;
	timeIntervals?: number;
	dateFormat?: string;
}

const portalRoot = typeof document !== "undefined" ? document.body : null;

export default function CustomDatePicker({
	value,
	onChange,
	className,
	customInput,
	disabled,
	showTimeSelect,
	showTimeSelectOnly,
	timeIntervals = 15,
	dateFormat = "yyyy-MM-dd",
}: CustomDatePickerProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const [coords, setCoords] = useState({ top: 0, left: 0 });

	const updateCoords = () => {
		if (containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect();
			setCoords({
				top: rect.bottom + window.scrollY,
				left: rect.left + window.scrollX,
			});
		}
	};

	const openPicker = () => {
		updateCoords();
		setIsOpen(!isOpen);
	};

	useEffect(() => {
		if (isOpen) {
			window.addEventListener("scroll", updateCoords, true);
			window.addEventListener("resize", updateCoords);
		}
		return () => {
			window.removeEventListener("scroll", updateCoords, true);
			window.removeEventListener("resize", updateCoords);
		};
	}, [isOpen]);

	// Parse string YYYY-MM-DD or HH:mm to Date object
	let selectedDate: Date | undefined = undefined;
	if (value) {
		if (showTimeSelectOnly) {
			// Parse HH:mm
			const parsed = parse(value, "HH:mm", new Date());
			if (!isNaN(parsed.getTime())) {
				selectedDate = parsed;
			}
		} else {
			selectedDate = parseISO(value);
		}
	}

	const handleChange = (date: Date | null) => {
		if (date) {
			if (showTimeSelectOnly) {
				onChange(format(date, "HH:mm"));
			} else {
				onChange(format(date, "yyyy-MM-dd"));
			}
		}
		if (!showTimeSelectOnly || !showTimeSelect) {
			setIsOpen(false);
		}
	};

	// --- 3-Column Time Picker Logic ---
	const parseTime = (timeStr: string) => {
		if (!timeStr) return { h: "08", m: "00", a: "AM" };
		const [h24, m] = timeStr.split(":");
		let h = parseInt(h24);
		const a = h >= 12 ? "PM" : "AM";
		h = h % 12 || 12;
		return { h: h.toString().padStart(2, "0"), m, a };
	};

	const formatTimeToStr = (h: string, m: string, a: string) => {
		let h24 = parseInt(h);
		if (a === "PM" && h24 < 12) h24 += 12;
		if (a === "AM" && h24 === 12) h24 = 0;
		return `${h24.toString().padStart(2, "0")}:${m}`;
	};

	const { h: currentH, m: currentM, a: currentA } = parseTime(value);

	const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"));
	const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));
	const ampm = ["AM", "PM"];

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				// Also check if click is inside portal
				const portal = document.getElementById("time-picker-portal");
				if (portal && portal.contains(event.target as Node)) return;
				setIsOpen(false);
			}
		};
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	const hourRef = useRef<HTMLDivElement>(null);
	const minRef = useRef<HTMLDivElement>(null);
	const ampmRef = useRef<HTMLDivElement>(null);

	const scrollColumn = (ref: React.RefObject<HTMLDivElement | null>, direction: "up" | "down") => {
		if (ref.current) {
			const amount = direction === "up" ? -30 : 30;
			ref.current.scrollBy({ top: amount, behavior: "smooth" });
		}
	};

	useEffect(() => {
		if (isOpen && showTimeSelectOnly) {
			const scrollIntoView = (ref: React.RefObject<HTMLDivElement | null>) => {
				const selected = ref.current?.querySelector(".selected");
				if (selected) {
					// Use block: "center" for better visibility
					selected.scrollIntoView({ block: "center", behavior: "auto" });
				}
			};
			// Small timeout to allow render
			setTimeout(() => {
				scrollIntoView(hourRef);
				scrollIntoView(minRef);
				scrollIntoView(ampmRef);
			}, 10);
		}
	}, [isOpen, showTimeSelectOnly]);

	const renderTimePicker = () => {
		if (!portalRoot) return null;
		return createPortal(
			<div
				id="time-picker-portal"
				className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-200"
				style={{
					top: coords.top - window.scrollY + 8,
					left: Math.min(coords.left, window.innerWidth - 160), // Prevent horizontal overflow
				}}
			>
				<div className="time-picker-popover">
					<div className="time-picker-header">Select Time</div>
					<div className="time-picker-columns">
						{/* Hours Column */}
						<div className="time-column-wrapper">
							<div className="time-scroll-btn" onClick={() => scrollColumn(hourRef, "up")}>
								<span className="material-symbols-outlined">expand_less</span>
							</div>
							<div className="time-column" ref={hourRef}>
								{hours.map((h) => (
									<div
										key={h}
										className={cn("time-option", currentH === h && "selected")}
										onClick={() => onChange(formatTimeToStr(h, currentM, currentA))}
									>
										{h}
									</div>
								))}
							</div>
							<div className="time-scroll-btn" onClick={() => scrollColumn(hourRef, "down")}>
								<span className="material-symbols-outlined">expand_more</span>
							</div>
						</div>

						{/* Minutes Column */}
						<div className="time-column-wrapper">
							<div className="time-scroll-btn" onClick={() => scrollColumn(minRef, "up")}>
								<span className="material-symbols-outlined">expand_less</span>
							</div>
							<div className="time-column" ref={minRef}>
								{minutes.map((m) => (
									<div
										key={m}
										className={cn("time-option", currentM === m && "selected")}
										onClick={() => onChange(formatTimeToStr(currentH, m, currentA))}
									>
										{m}
									</div>
								))}
							</div>
							<div className="time-scroll-btn" onClick={() => scrollColumn(minRef, "down")}>
								<span className="material-symbols-outlined">expand_more</span>
							</div>
						</div>

						{/* AM/PM Column */}
						<div className="time-column-wrapper">
							<div className="time-scroll-btn" onClick={() => scrollColumn(ampmRef, "up")}>
								<span className="material-symbols-outlined">expand_less</span>
							</div>
							<div className="time-column" ref={ampmRef}>
								{ampm.map((a) => (
									<div
										key={a}
										className={cn("time-option", currentA === a && "selected")}
										onClick={() => onChange(formatTimeToStr(currentH, currentM, a))}
									>
										{a}
									</div>
								))}
							</div>
							<div className="time-scroll-btn" onClick={() => scrollColumn(ampmRef, "down")}>
								<span className="material-symbols-outlined">expand_more</span>
							</div>
						</div>
					</div>
				</div>
			</div>,
			portalRoot,
		);
	};

	if (showTimeSelectOnly) {
		return (
			<div className={cn("custom-datepicker-wrapper relative", className)} ref={containerRef}>
				{customInput ? (
					React.cloneElement(customInput as React.ReactElement, {
						onClick: openPicker,
					})
				) : (
					<button type="button" onClick={openPicker} className="w-full text-left">
						{value || "Select Time"}
					</button>
				)}
				{isOpen && renderTimePicker()}
			</div>
		);
	}

	return (
		<div className={cn("custom-datepicker-wrapper", className)}>
			<DatePicker
				selected={selectedDate}
				onChange={handleChange}
				disabled={disabled}
				showTimeSelect={showTimeSelect}
				showTimeSelectOnly={showTimeSelectOnly}
				timeIntervals={timeIntervals}
				timeCaption="Time"
				customInput={customInput as React.ReactElement}
				dateFormat={dateFormat || "yyyy-MM-dd"}
				popperPlacement="bottom-start"
				showPopperArrow={false}
				calendarClassName="font-sans"
				portalId="picker-portal"
				renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
					<div className="flex items-center justify-between px-2 py-1">
						<button
							onClick={decreaseMonth}
							disabled={prevMonthButtonDisabled}
							type="button"
							className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
						>
							<span className="material-symbols-outlined !text-lg text-gray-400">chevron_left</span>
						</button>
						<span className="text-[10px] font-bold text-primary uppercase tracking-widest font-display">{format(date, "MMMM yyyy")}</span>
						<button
							onClick={increaseMonth}
							disabled={nextMonthButtonDisabled}
							type="button"
							className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
						>
							<span className="material-symbols-outlined !text-lg text-gray-400">chevron_right</span>
						</button>
					</div>
				)}
			/>
		</div>
	);
}
