import React, { useEffect, useId, useRef, useState } from "react";
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
	value: string; // YYYY-MM-DD, HH:mm, or YYYY-MM-DDTHH:mm
	onChange: (date: string) => void;
	mode?: "date" | "time" | "datetime";
	currentShift?: "Day" | "Night" | "General";
	onShiftChange?: (shift: "Day" | "Night" | "General") => void;
	className?: string; // Class for the wrapper
	wrapperClassName?: string;
	customInput?: React.ReactNode;
	disabled?: boolean;
	showTimeSelect?: boolean;
	showTimeSelectOnly?: boolean;
	showDateTimeSelect?: boolean;
	timeIntervals?: number;
	dateFormat?: string;
}

const portalId = "picker-portal";

export default function CustomDatePicker({
	value,
	onChange,
	mode = "date",
	currentShift,
	onShiftChange,
	className,
	customInput,
	disabled,
	showTimeSelect,
	showTimeSelectOnly,
	showDateTimeSelect,
	timeIntervals = 15,
	dateFormat = "yyyy-MM-dd",
}: CustomDatePickerProps) {
	const isTimeMode = mode === "time" || showTimeSelectOnly;
	const isDateTimeMode = mode === "datetime" || showDateTimeSelect;
	const TIME_POPOVER_WIDTH = 150;
	const DATETIME_POPOVER_WIDTH = 346;
	const instanceId = useId().replace(/:/g, "");
	const timePortalElementId = `time-picker-portal-${instanceId}`;
	const dateTimePortalElementId = `datetime-picker-portal-${instanceId}`;

	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const [coords, setCoords] = useState({ top: 0, left: 0, right: 0, boundaryLeft: 8, boundaryRight: 8 });

	const updateCoords = () => {
		if (containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect();
			const boundaryEl = containerRef.current.closest("[data-picker-boundary]") as HTMLElement | null;
			const boundaryRect = boundaryEl?.getBoundingClientRect();
			const boundaryLeft = boundaryRect ? boundaryRect.left + 8 : 8;
			const boundaryRight = boundaryRect ? boundaryRect.right - 8 : window.innerWidth - 8;
			setCoords({
				top: rect.bottom,
				left: rect.left,
				right: rect.right,
				boundaryLeft,
				boundaryRight,
			});
		}
	};

	const getPopoverLeft = (popoverWidth: number) => {
		const viewportLeft = coords.boundaryLeft;
		const viewportRight = coords.boundaryRight;
		let nextLeft = coords.left;
		const effectiveWidth = Math.min(popoverWidth, Math.max(220, viewportRight - viewportLeft));

		if (nextLeft + effectiveWidth > viewportRight) {
			nextLeft = coords.right - effectiveWidth;
		}

		if (nextLeft < viewportLeft) {
			nextLeft = viewportLeft;
		}

		return nextLeft;
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
	const selectedDateTime = (() => {
		if (!value) return new Date();
		const parsed = parseISO(value);
		return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
	})();
	const currentDatePart = format(selectedDateTime, "yyyy-MM-dd");
	const currentTimePart = format(selectedDateTime, "HH:mm");

	if (value) {
		if (isTimeMode) {
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
			if (isTimeMode) {
				onChange(format(date, "HH:mm"));
			} else if (isDateTimeMode) {
				onChange(format(date, "yyyy-MM-dd'T'HH:mm"));
			} else {
				onChange(format(date, "yyyy-MM-dd"));
			}
		}
		if (!isTimeMode || !showTimeSelect) {
			setIsOpen(false);
		}
	};

	const combineDateAndTime = (dateStr: string, timeStr: string) => {
		const parsedDate = parseISO(`${dateStr}T00:00`);
		if (Number.isNaN(parsedDate.getTime())) return;
		const [h, m] = timeStr.split(":").map((part) => Number(part));
		parsedDate.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
		onChange(format(parsedDate, "yyyy-MM-dd'T'HH:mm"));
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
				const portal = document.getElementById(timePortalElementId);
				if (portal && portal.contains(event.target as Node)) return;
				const dateTimePortal = document.getElementById(dateTimePortalElementId);
				if (dateTimePortal && dateTimePortal.contains(event.target as Node)) return;
				setIsOpen(false);
			}
		};
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [dateTimePortalElementId, isOpen, timePortalElementId]);

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
		if (isOpen && (isTimeMode || isDateTimeMode)) {
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
	}, [isOpen, isTimeMode, isDateTimeMode]);

	const renderTimePicker = () => {
		const root = typeof document !== "undefined" ? document.getElementById("time-picker-portal-root") : null;
		if (!root) return null;
		return createPortal(
			<div
				id={timePortalElementId}
				className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-200"
				style={{
					top: coords.top + 8,
					left: getPopoverLeft(TIME_POPOVER_WIDTH),
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
			root,
		);
	};

	const renderDateTimePicker = () => {
		const root = typeof document !== "undefined" ? document.getElementById("time-picker-portal-root") : null;
		if (!root) return null;
		const { h: dtH, m: dtM, a: dtA } = parseTime(currentTimePart);
		const boundaryWidth = Math.max(220, coords.boundaryRight - coords.boundaryLeft);
		const constrainedWidth = Math.min(DATETIME_POPOVER_WIDTH, boundaryWidth);
		const isCompactLayout = constrainedWidth < DATETIME_POPOVER_WIDTH;
		const popupWidth = isCompactLayout ? constrainedWidth : DATETIME_POPOVER_WIDTH;

		const setDatePart = (nextDate: Date | null) => {
			if (!nextDate) return;
			const nextDatePart = format(nextDate, "yyyy-MM-dd");
			combineDateAndTime(nextDatePart, currentTimePart);
		};

		const setTimePart = (nextTime: string) => {
			combineDateAndTime(currentDatePart, nextTime);
		};

		return createPortal(
			<div
				id={dateTimePortalElementId}
				className={cn("fixed z-[9999] animate-in fade-in zoom-in-95 duration-200", isCompactLayout && "datetime-picker-compact")}
				style={{
					top: coords.top + 8,
					left: getPopoverLeft(popupWidth),
					width: `${popupWidth}px`,
				}}
			>
				<div className="datetime-picker-popover">
					<div className="datetime-calendar-pane">
						<DatePicker
							selected={selectedDateTime}
							onChange={setDatePart}
							inline
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
					<div className="datetime-time-pane">
						<div className="time-picker-popover datetime-time-popover !shadow-none !border-0">
							<div className="time-picker-header">Select Time</div>
							<div className="time-picker-columns">
								<div className="time-column-wrapper">
									<div className="time-scroll-btn" onClick={() => scrollColumn(hourRef, "up")}>
										<span className="material-symbols-outlined">expand_less</span>
									</div>
									<div className="time-column" ref={hourRef}>
										{hours.map((h) => (
											<div
												key={h}
												className={cn("time-option", dtH === h && "selected")}
												onClick={() => setTimePart(formatTimeToStr(h, dtM, dtA))}
											>
												{h}
											</div>
										))}
									</div>
									<div className="time-scroll-btn" onClick={() => scrollColumn(hourRef, "down")}>
										<span className="material-symbols-outlined">expand_more</span>
									</div>
								</div>

								<div className="time-column-wrapper">
									<div className="time-scroll-btn" onClick={() => scrollColumn(minRef, "up")}>
										<span className="material-symbols-outlined">expand_less</span>
									</div>
									<div className="time-column" ref={minRef}>
										{minutes.map((m) => (
											<div
												key={m}
												className={cn("time-option", dtM === m && "selected")}
												onClick={() => setTimePart(formatTimeToStr(dtH, m, dtA))}
											>
												{m}
											</div>
										))}
									</div>
									<div className="time-scroll-btn" onClick={() => scrollColumn(minRef, "down")}>
										<span className="material-symbols-outlined">expand_more</span>
									</div>
								</div>

								<div className="time-column-wrapper">
									<div className="time-scroll-btn" onClick={() => scrollColumn(ampmRef, "up")}>
										<span className="material-symbols-outlined">expand_less</span>
									</div>
									<div className="time-column" ref={ampmRef}>
										{ampm.map((a) => (
											<div
												key={a}
												className={cn("time-option", dtA === a && "selected")}
												onClick={() => setTimePart(formatTimeToStr(dtH, dtM, a))}
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
					</div>
				</div>
			</div>,
			root,
		);
	};

	if (isTimeMode) {
		return (
			<div className={cn("custom-datepicker-wrapper relative", className)} ref={containerRef}>
				{customInput ? (
					<div
						role="button"
						tabIndex={0}
						onClick={openPicker}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								openPicker();
							}
						}}
					>
						{customInput}
					</div>
				) : (
					<button type="button" onClick={openPicker} className="w-full text-left">
						{value || "Select Time"}
					</button>
				)}
				{isOpen && renderTimePicker()}
			</div>
		);
	}

	if (isDateTimeMode) {
		return (
			<div className={cn("custom-datepicker-wrapper relative", className)} ref={containerRef}>
				{customInput ? (
					<div
						role="button"
						tabIndex={0}
						onClick={openPicker}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								openPicker();
							}
						}}
					>
						{customInput}
					</div>
				) : (
					<button type="button" onClick={openPicker} className="w-full text-left">
						{value || "Select Date & Time"}
					</button>
				)}
				{isOpen && renderDateTimePicker()}
			</div>
		);
	}

	return (
		<div className={cn("custom-datepicker-wrapper relative z-50", className)}>
				<DatePicker
					selected={selectedDate}
					onChange={handleChange}
					disabled={disabled}
					showTimeSelect={showTimeSelect}
					showTimeSelectOnly={isTimeMode}
					timeIntervals={timeIntervals}
				timeCaption="Time"
				customInput={customInput as React.ReactElement}
				dateFormat={dateFormat || "yyyy-MM-dd"}
				popperPlacement="bottom-start"
				showPopperArrow={false}
				calendarClassName="font-sans"
				portalId={portalId}
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
			>
				{onShiftChange && currentShift && (
					<div className="p-2 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-2 w-full">
						<div className="flex bg-white border border-gray-200 rounded-lg p-0.5 w-full">
							<button
								type="button"
								onClick={() => onShiftChange("Day")}
								className={cn(
									"flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all",
									currentShift === "Day" ? "bg-primary text-white shadow-sm" : "text-gray-400 hover:text-primary",
								)}
							>
								Day
							</button>
							<button
								type="button"
								onClick={() => onShiftChange("General")}
								className={cn(
									"flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all",
									currentShift === "General" ? "bg-primary text-white shadow-sm" : "text-gray-400 hover:text-primary",
								)}
							>
								General
							</button>
							<button
								type="button"
								onClick={() => onShiftChange("Night")}
								className={cn(
									"flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all",
									currentShift === "Night" ? "bg-primary text-white shadow-sm" : "text-gray-400 hover:text-primary",
								)}
							>
								Night
							</button>
						</div>
					</div>
				)}
			</DatePicker>
		</div>
	);
}
