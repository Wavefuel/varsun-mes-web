import { AssignmentField, AssignmentInput, AssignmentLabel, AssignmentSelect } from "./AssignmentComponents";
import React, { useEffect, useRef, useState } from "react";

import CustomDatePicker from "@/components/CustomDatePicker";
import type { DeviceSummary } from "@/utils/scripts";

export interface AssignmentFormData {
	machine: string;
	operator: string;
	date: string;
	shift: string;
	startTime: string;
	endTime: string;
	code: string;
	partNumber: string;
	workOrderId: string;
	opNumber: number;
	batch: number;
	estTime: string;
	estUnit: string;
}

interface AssignmentDetailsCardProps {
	title: string;
	icon: string;
	data: AssignmentFormData;
	onChange: (field: keyof AssignmentFormData, value: any) => void;
	errors?: Record<string, boolean>;
	readOnly?: boolean;
	isEditMode?: boolean;
	hideHeader?: boolean;
	devices?: DeviceSummary[];
	selectedDeviceId?: string;
	onDeviceChange?: (deviceId: string) => void;
}

export default function AssignmentDetailsCard({
	title,
	icon,
	data,
	onChange,
	errors = {},
	readOnly = false,
	isEditMode = false,
	hideHeader = false,
	devices = [],
	selectedDeviceId,
	onDeviceChange,
}: AssignmentDetailsCardProps) {
	// Helper to handle input changes
	const handleChange = (field: keyof AssignmentFormData, value: any) => {
		if (readOnly) return;
		onChange(field, value);
	};

	const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
	const unitDropdownRef = useRef<HTMLDivElement>(null);

	// Shift validation
	const isDayShift = data.shift === "Day Shift (S1)";
	// 8am to 8pm constraints
	const minTime = isDayShift ? "08:00" : undefined;
	const maxTime = isDayShift ? "20:00" : undefined;

	const deviceLabel = (device?: DeviceSummary) =>
		device?.deviceName || device?.serialNumber || device?.foreignId || device?.id || "Unknown Device";

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
				setIsUnitDropdownOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	return (
		<section className={`bg-white !rounded-xl border border-gray-100 shadow-sm ${hideHeader ? "!border-t-0 !rounded-t-none" : ""}`}>
			{!hideHeader && (
				<div className="bg-gray-50 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center rounded-t-xl">
					<h3 className="font-bold text-sm uppercase tracking-wider text-primary">{title}</h3>
					<span className={`material-symbols-outlined text-gray-400 !text-2xl`}>{icon}</span>
				</div>
			)}

			<div className="p-4  space-y-2">
				{/* Dropdowns Pair (Machine & Operator) */}
				<div className="grid grid-cols-2 !gap-3">
					<AssignmentField label="Machine">
						<AssignmentSelect
							value={selectedDeviceId || data.machine}
							title={
								devices.length
									? deviceLabel(devices.find((d) => d.id === (selectedDeviceId || data.machine)))
									: data.machine
							}
							onChange={(e) => {
								const nextId = e.target.value;
								if (devices.length) {
									onDeviceChange?.(nextId);
									const device = devices.find((entry) => entry.id === nextId);
									handleChange("machine", deviceLabel(device));
								} else {
									handleChange("machine", nextId);
								}
							}}
							disabled={readOnly}
						>
							{devices.length
								? devices.map((device) => {
									const label = deviceLabel(device);
									return (
										<option key={device.id} value={device.id} title={label}>
											{label.length > 25 ? label.substring(0, 25) + "..." : label}
										</option>
									);
								})
								: [
									<option key="cnc" value="CNC-042 (Alpha)" title="CNC-042 (Alpha)">
										CNC-042 (Alpha)
									</option>,
									<option key="lath" value="LATH-09 (Beta)" title="LATH-09 (Beta)">
										LATH-09 (Beta)
									</option>,
									<option key="mill" value="MILL-12 (Gamma)" title="MILL-12 (Gamma)">
										MILL-12 (Gamma)
									</option>,
								]}
						</AssignmentSelect>
					</AssignmentField>

					<AssignmentField label="Operator">
						<AssignmentSelect value={data.operator} onChange={(e) => handleChange("operator", e.target.value)} disabled={readOnly}>
							<option>Marcus Jensen</option>
							<option>Sarah Chen</option>
							<option>David Miller</option>
						</AssignmentSelect>
					</AssignmentField>
				</div>

				{/* Date and Shift Selection */}
				<div className="grid grid-cols-2 !gap-3">
					<AssignmentField label="Shift Date">
						<div className="relative w-full">
							{readOnly ? (
								<div className="w-full relative bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 text-left">
									<span className="!text-xs font-medium block pr-8 text-gray-500">
										{data.date
											? new Date(data.date).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
												year: "numeric",
											})
											: "Select Date"}
									</span>
									<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 !text-gray-400 !text-xl pointer-events-none">
										calendar_today
									</span>
								</div>
							) : (
								<CustomDatePicker
									value={data.date}
									onChange={(date) => handleChange("date", date)}
									customInput={
										<button className="w-full relative bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 text-left transition-all">
											<span className="!text-xs font-medium block pr-8">
												{data.date
													? new Date(data.date).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
														year: "numeric",
													})
													: "Select Date"}
											</span>
											<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 !text-gray-400 !text-xl pointer-events-none">
												calendar_today
											</span>
										</button>
									}
								/>
							)}
						</div>
					</AssignmentField>

					<AssignmentField label="Shift Work">
						<AssignmentSelect value={data.shift} onChange={(e) => handleChange("shift", e.target.value)} disabled={readOnly}>
							<option>Day Shift (S1)</option>
							<option>Night Shift (S2)</option>
							<option>Custom</option>
						</AssignmentSelect>
					</AssignmentField>
				</div>

				{/* Visual Logic Badges (Code/Start/End) */}
				<div className="!space-y-1.5">
					<AssignmentLabel>Schedule</AssignmentLabel>
					<div
						className={`flex !gap-2 bg-primary/5 !p-3 rounded-lg border transition-colors ${errors.shift ? "border-red-500 bg-red-50" : "border-primary/10"
							}`}
					>
						<div className="flex-1 flex flex-col justify-center">
							<p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">Code</p>
							<input
								type="text"
								value={data.code}
								onChange={(e) => handleChange("code", e.target.value)}
								disabled={readOnly}
								className={`w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 placeholder-primary/50 leading-none h-auto ${readOnly ? "cursor-not-allowed" : ""
									}`}
							/>
						</div>
						<div className="w-px bg-primary/20"></div>
						<div className="flex-1 flex flex-col justify-center">
							<p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">Start</p>
							<input
								type="time"
								value={data.startTime}
								onChange={(e) => handleChange("startTime", e.target.value)}
								disabled={readOnly}
								min={minTime}
								max={maxTime}
								className={`w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto ${readOnly ? "cursor-not-allowed" : ""
									}`}
							/>
						</div>
						<div className="w-px bg-primary/20"></div>
						<div className="flex-1 flex flex-col justify-center">
							<p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">End</p>
							<input
								type="time"
								value={data.endTime}
								onChange={(e) => handleChange("endTime", e.target.value)}
								disabled={readOnly}
								min={minTime}
								max={maxTime}
								className={`w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto ${readOnly ? "cursor-not-allowed" : ""
									}`}
							/>
						</div>
					</div>
				</div>

				{/* Production Details */}
				{/* Part # & WO # */}
				<div className="grid grid-cols-2 !gap-3">
					<AssignmentField label="Part Number">
						<AssignmentInput
							type="text"
							value={data.partNumber}
							onChange={(e) => handleChange("partNumber", e.target.value)}
							disabled={readOnly}
							hasError={!!errors.partNumber}
							className="font-mono"
							placeholder="P-90882-X"
						/>
					</AssignmentField>

					<AssignmentField label="Work Order">
						<AssignmentInput
							type="text"
							value={data.workOrderId}
							onChange={(e) => handleChange("workOrderId", e.target.value)}
							disabled={readOnly || isEditMode}
							hasError={!!errors.workOrderId}
							className={`font-mono ${isEditMode || readOnly ? "!bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200" : ""}`}
							placeholder="WO-55612"
						/>
					</AssignmentField>
				</div>

				{/* Op / Batch / Est */}
				<div className="grid grid-cols-3 !gap-3">
					<AssignmentField label="Op #">
						<AssignmentInput
							type="number"
							value={data.opNumber}
							onChange={(e) => handleChange("opNumber", Number(e.target.value))}
							disabled={readOnly}
						/>
					</AssignmentField>

					<AssignmentField label="Batch Qty">
						<AssignmentInput
							type="number"
							value={data.batch}
							onChange={(e) => handleChange("batch", Number(e.target.value))}
							disabled={readOnly}
							hasError={!!errors.capacity}
						/>
					</AssignmentField>

					<AssignmentField label={`Est/Part (${data.estUnit})`}>
						<div className="relative" ref={unitDropdownRef}>
							<AssignmentInput
								type="text"
								value={data.estTime}
								onChange={(e) => handleChange("estTime", e.target.value)}
								disabled={readOnly}
								className={`!text-left pr-8 ${readOnly ? "cursor-not-allowed" : ""}`}
								placeholder="1.5"
							/>
							<div
								onClick={() => !readOnly && setIsUnitDropdownOpen(!isUnitDropdownOpen)}
								className={`absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-pointer transition-transform duration-200 ${isUnitDropdownOpen ? "rotate-180" : ""
									}`}
							>
								<span className="material-symbols-outlined text-gray-400 !text-xl">expand_more</span>
							</div>

							{isUnitDropdownOpen && (
								<div className="absolute right-0 top-full mt-1 w-24 bg-white shadow-lg rounded-lg overflow-hidden z-50 border border-gray-200 animate-in fade-in zoom-in-95 duration-100">
									{["min", "hr"].map((unit) => (
										<div
											key={unit}
											onClick={() => {
												handleChange("estUnit", unit);
												setIsUnitDropdownOpen(false);
											}}
											className={`px-3 py-2 text-sm font-medium cursor-pointer transition-colors text-left ${data.estUnit === unit ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
												}`}
										>
											{unit}
										</div>
									))}
								</div>
							)}
						</div>
					</AssignmentField>
				</div>
			</div>
		</section>
	);
}
