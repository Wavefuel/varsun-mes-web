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

export default function StockPage() {
	const { orders, currentDate, setCurrentDate } = useData();
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState("All");
	const [showFilters, setShowFilters] = useState(false);

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
	const filteredOrders = orders.filter((order) => {
		// Filter by Date - only show stock/orders for specific day
		if (order.date !== currentDate) return false;

		const matchesSearch =
			order.machine.toLowerCase().includes(searchQuery.toLowerCase()) ||
			order.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
			order.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
			order.id.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesStatus = filterStatus === "All" || order.status === filterStatus.toUpperCase();

		return matchesSearch && matchesStatus;
	});

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard pb-24">
			<AppHeader title="Stock & Inventory" subtitle="Material Management" showDateNavigator={true} />

			{/* Sticky Controls Container */}
			<div className="sticky top-[var(--header-height-expanded)] z-20 bg-background-dashboard pb-3 px-4">
				{/* Search & Filter Row */}
				<SearchFilterBar
					className="mt-3"
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					placeholder="Search stock..."
					showFilters={showFilters}
					onToggleFilters={() => setShowFilters(!showFilters)}
				/>

				{/* Filter Panel */}
				{showFilters && (
					<div className="mt-3 animate-in slide-in-from-top-1 fade-in duration-200">
						<div>
							<p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Status</p>
							<div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
								{["All", "Planned", "Completed"].map((status) => (
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
					</div>
				)}
			</div>

			<main className="px-4 space-y-3 pt-2 flex-1 flex flex-col">
				{filteredOrders.map((order) => (
					<Link
						key={order.id}
						href={`/stock/${encodeURIComponent(order.id)}`}
						className="planning-card border-card-border active:scale-[0.99] hover:border-card-border"
					>
						<div className="flex justify-between items-start gap-4">
							{/* Left Column */}
							<div className="flex flex-col gap-0.5 flex-1">
								{/* Header: Machine + Status */}
								<div className="flex items-center gap-2">
									<h3 className="list-title">{order.machine}</h3>
									<div
										className={cn(
											"size-2 rounded-full",
											order.status === "PLANNED"
												? "bg-status-planned"
												: order.status === "COMPLETED"
													? "bg-status-completed"
													: "bg-status-default",
										)}
									></div>
								</div>

								{/* Part Number • WO */}
								<p className="list-subtext">
									{order.partNumber} • {order.id}
								</p>

								{/* Operator */}
								<p className="list-subtext">{order.operator}</p>
							</div>

							{/* Right Column */}
							<div className="list-metric-column">
								{/* Shift Badge */}
								<span className="list-tag text-primary bg-primary/10">
									{order.startTime} - {order.endTime}
								</span>
							</div>
						</div>
					</Link>
				))}

				{/* Empty State */}
				{filteredOrders.length === 0 && (
					<div className="flex-1 flex flex-col items-center justify-center -mt-20">
						<EmptyState
							icon="inventory_2"
							title="No Stock Found"
							description={
								<span>
									No stock items found for <br />
									<span className="font-bold text-gray-600">{formatDateForDisplay(currentDate)}</span>
								</span>
							}
						/>
					</div>
				)}
			</main>
		</div>
	);
}
