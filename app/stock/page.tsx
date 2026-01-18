"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import SearchFilterBar from '@/components/SearchFilterBar';
import DateNavigator from '@/components/DateNavigator';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function StockPage() {
    const { orders, currentDate, setCurrentDate } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [showFilters, setShowFilters] = useState(false);

    const formatDateForDisplay = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }).toUpperCase();
    };

    // Filter Logic
    const filteredOrders = orders.filter(order => {
        // Filter by Date - only show stock/orders for specific day
        if (order.date !== currentDate) return false;

        const matchesSearch =
            order.machine.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.id.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = filterStatus === 'All' || order.status === filterStatus.toUpperCase();

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard pb-24">
            <AppHeader title="Stock & Inventory" subtitle="Material Management" />

            {/* Sticky Controls Container */}
            <div className="sticky top-[68px] z-20 bg-background-dashboard pb-3 px-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.1)]">

                {/* Date Navigator */}
                <div className="pb-0 transition-opacity">
                    <DateNavigator
                        currentDate={currentDate}
                        setCurrentDate={setCurrentDate}
                    />
                </div>

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
                        <div className="flex gap-2 overflow-x-auto scrollbar-none">
                            {['All', 'Planned', 'Completed'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap",
                                        filterStatus === status
                                            ? "bg-primary border-primary text-white"
                                            : "bg-white border-gray-200 text-gray-500"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <main className="px-4 space-y-3 pt-2">
                {filteredOrders.map((order) => (
                    <Link
                        key={order.id}
                        href={`/stock/${encodeURIComponent(order.id)}`}
                        className="list-card card-shadow active:scale-[0.99] transition-transform"
                    >
                        <div className="flex justify-between items-start gap-4">
                            {/* Left Column */}
                            <div className="flex flex-col gap-0.5 flex-1">
                                {/* Header: Machine + Status */}
                                <div className="flex items-center gap-2">
                                    <h3 className="list-title">{order.machine}</h3>
                                    <div className={cn(
                                        "size-2 rounded-full",
                                        order.status === 'PLANNED' ? "bg-status-planned" :
                                            order.status === 'COMPLETED' ? "bg-status-completed" : "bg-status-default"
                                    )}></div>
                                </div>

                                {/* Part Number • WO */}
                                <p className="list-subtext">{order.partNumber} • {order.id}</p>

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
                    <div className="text-center py-12 flex flex-col items-center opacity-60">
                        <span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">search_off</span>
                        <p className="text-sm font-bold text-gray-400">No stock items found for {formatDateForDisplay(currentDate)}</p>
                    </div>
                )}
            </main>
        </div>
    );
}
