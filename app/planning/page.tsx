"use client";

import React, { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SearchFilterBar from "@/components/SearchFilterBar";
import EmptyState from "@/components/EmptyState";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useData } from "@/context/DataContext";
import { toast } from "sonner";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export default function PlanningPage() {
	const { orders, currentDate, setCurrentDate, deleteOrder } = useData();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState("All");
	const [filterMachine, setFilterMachine] = useState("All");
	const [showFilters, setShowFilters] = useState(false);
	const [isDeleteMode, setIsDeleteMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const formatDateForDisplay = (dateStr: string) => {
		const date = new Date(dateStr);
		return date
			.toLocaleDateString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
			})
			.toUpperCase();
	};

	// Filter Logic
	const filteredAssignments = orders.filter((item) => {
		// Filter by Date
		if (item.date !== currentDate) return false;

		// User requested to only see planning, not completed ones
		// Casting to string to avoid TypeScript error if type definition is too narrow
		if ((item.status as string) === "COMPLETED") return false;

		const matchesSearch =
			item.machine.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.id.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesStatus = filterStatus === "All" || item.status === filterStatus;
		const matchesMachine = filterMachine === "All" || item.machine === filterMachine;

		// matchesDeleteMode is no longer needed since we globally filter out COMPLETED items

		return matchesSearch && matchesStatus && matchesMachine;
	});

	// Selection Logic
	const toggleSelection = (id: string) => {
		setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
	};

	const handleBatchDeleteClick = () => {
		if (selectedIds.length === 0) return;
		setShowDeleteConfirm(true);
	};

	const confirmDelete = () => {
		selectedIds.forEach((id) => deleteOrder(id));
		setSelectedIds([]);
		setIsDeleteMode(false);
		setShowDeleteConfirm(false);
		toast.success(`Deleted ${selectedIds.length} items`);
	};

	const toggleDeleteMode = () => {
		const newMode = !isDeleteMode;
		setIsDeleteMode(newMode);
		if (!newMode) setSelectedIds([]);
	};

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard pb-24">
			<AppHeader title="Planning" subtitle="Shift Scheduling" showDateNavigator={true} dateNavigatorDisabled={isDeleteMode} />

			{/* Sticky Controls Container */}
			<div className="sticky top-[var(--header-height-expanded)] z-20 bg-background-dashboard pb-3 px-4">
				{/* Search & Filter Row */}
				<SearchFilterBar
					className="mt-3"
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					placeholder="Search assignments..."
					showFilters={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
				/>

				{/* Filter Panel */}
				{showFilters && (
					<div className="mt-3 animate-in slide-in-from-top-1 fade-in duration-200 space-y-3">
						{/* Status Filter */}
						<div>
							<p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Status</p>
							<div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
								{["All", "PLANNED"].map((status) => (
									<button
										key={status}
										onClick={() => setFilterStatus(status)}
										className={cn(
											"planning-filter-btn",
											filterStatus === status
												? "bg-primary border-primary text-white"
												: "bg-white border-card-border text-primary/70 hover:text-primary",
										)}
									>
										{status}
									</button>
								))}
							</div>
						</div>

						{/* Machine Filter */}
						<div>
							<p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Machine</p>
							<div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
								{["All", ...Array.from(new Set(orders.map((o) => o.machine))).sort()].map((machine) => (
									<button
										key={machine}
										onClick={() => setFilterMachine(machine)}
										className={cn(
											"planning-filter-btn",
											filterMachine === machine
												? "bg-primary border-primary text-white"
												: "bg-white border-card-border text-primary/70 hover:text-primary",
										)}
									>
										{machine}
									</button>
								))}
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Assignments List */}
			<main className="px-4 space-y-3 pt-2 flex-1 flex flex-col">
				{filteredAssignments.map((item) => (
					<Link
						key={item.id}
						href={isDeleteMode ? "#" : `/planning/create?id=${encodeURIComponent(item.id)}`}
						className={cn(
							"planning-card",
							isDeleteMode ? "cursor-default" : "active:scale-[0.99] hover:border-card-border border-card-border",
							selectedIds.includes(item.id) ? "planning-card-selected" : "border-card-border",
						)}
						onClick={(e) => {
							if (isDeleteMode) {
								e.preventDefault();
								toggleSelection(item.id);
							}
						}}
					>
						<div className="flex justify-between items-start gap-4">
							{/* Left Column */}
							<div className="flex flex-col gap-0.5 flex-1">
								{/* Header: Machine + Status */}
								<div className="flex items-center gap-2">
									<h3 className="list-title">{item.machine}</h3>
									<div
										className={cn(
											"size-2 rounded-full",
											item.status === "PLANNED"
												? "bg-status-planned"
												: item.status === "COMPLETED"
													? "bg-status-completed"
													: "bg-status-default",
										)}
									></div>
								</div>

								{/* Part Number • WO */}
								<p className="list-subtext">
									{item.partNumber} • {item.id}
								</p>

								{/* Operator */}
								<p className="list-subtext">{item.operator}</p>
							</div>

							{/* Right Column: Info OR Radio Selection */}
							<div className="list-metric-column">
								{isDeleteMode ? (
									<div
										className={cn(
											"size-6 rounded-full border-[1.5px] flex items-center justify-center transition-all",
											selectedIds.includes(item.id) ? "border-destructive bg-destructive-bg" : "border-card-border bg-white",
										)}
									>
										{selectedIds.includes(item.id) && (
											<div className="size-3.5 rounded-full bg-destructive shadow-sm animate-in zoom-in-75 duration-200" />
										)}
									</div>
								) : (
									<>
										{/* Time Badge (Primary Color) */}
										<span className="list-tag text-primary bg-primary/10">
											{item.startTime} - {item.endTime}
										</span>
									</>
								)}
							</div>
						</div>
					</Link>
				))}

				{/* Empty State */}
				{filteredAssignments.length === 0 && (
					<div className="flex-1 flex flex-col items-center justify-center -mt-20">
						<EmptyState
							icon="event_busy"
							title="No Plans Found"
							description={
								<span>
									No assignments scheduled for <br />
									<span className="text-primary font-bold mt-1 block">{formatDateForDisplay(currentDate)}</span>
								</span>
							}
						/>
					</div>
				)}
			</main>

			{/* Floating Action Buttons */}
			<div className="fixed bottom-[74px] right-5 z-40 flex flex-col items-center gap-3 w-12">
				{/* Confirm Delete FAB */}
				{isDeleteMode && selectedIds.length > 0 && (
					<button
						onClick={handleBatchDeleteClick}
						className="planning-fab bg-destructive shadow-[0_4px_14px_rgba(239,68,68,0.4)] animate-in zoom-in-50 duration-200 active:scale-95"
					>
						<span className="material-symbols-outlined icon-pl-fab">check</span>
					</button>
				)}

				{/* Create FAB (Normal Mode) */}
				{!isDeleteMode && (
					<Link href="/planning/create" className="planning-fab bg-primary shadow-[0_4px_14px_rgba(0,0,0,0.25)] active:scale-95">
						<span className="material-symbols-outlined icon-pl-fab">add</span>
					</Link>
				)}

				{/* Toggle Delete Mode FAB */}
				<button
					onClick={toggleDeleteMode}
					className={cn(
						"rounded-full shadow-lg flex items-center justify-center transition-all duration-300 bg-white border border-gray-100",
						isDeleteMode ? "size-10 text-gray-500 hover:text-gray-800" : "size-10 text-gray-400 hover:text-destructive",
					)}
					title={isDeleteMode ? "Cancel" : "Delete Assignments"}
				>
					<span className={cn("material-symbols-outlined", isDeleteMode ? "icon-pl-action-active" : "icon-pl-action")}>
						{isDeleteMode ? "close" : "delete"}
					</span>
				</button>
			</div>

			{/* Custom Delete Confirmation Modal */}
			{/* Custom Delete Confirmation Modal */}
			{showDeleteConfirm && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200">
					<div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[320px] p-6 animate-in zoom-in-95 duration-200 border border-white/20">
						<div className="size-12 rounded-full bg-destructive-bg text-destructive flex items-center justify-center mb-4 mx-auto">
							<span className="material-symbols-outlined icon-pl-modal">delete</span>
						</div>
						<h3 className="text-base font-bold text-gray-900 mb-2 text-center font-display">Delete Assignments?</h3>
						<p className="text-sm font-medium text-gray-500 mb-6 text-center leading-relaxed">
							Are you sure you want to delete <strong className="text-gray-800">{selectedIds.length}</strong> selected assignments?{" "}
							<br />
							This action cannot be undone.
						</p>
						<div className="flex gap-3">
							<button
								onClick={() => setShowDeleteConfirm(false)}
								className="flex-1 h-11 flex items-center justify-center rounded-xl bg-background-dashboard text-gray-600 font-bold text-sm hover:bg-gray-100 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={confirmDelete}
								className="flex-1 h-11 flex items-center justify-center rounded-xl bg-destructive text-white font-bold text-sm hover:bg-red-600 shadow-md transition-all active:scale-95"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
