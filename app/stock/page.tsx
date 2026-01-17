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
                <div className="pt-1 pb-0 transition-opacity">
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
                        // Use encodeURIComponent just in case IDs have special chars
                        href={`/stock/${encodeURIComponent(order.id)}`}
                        className="block bg-white rounded-xl border border-card-border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all relative overflow-hidden active:scale-[0.99] hover:border-gray-300"
                    >
                        <div className="flex justify-between items-start gap-4">
                            {/* Left Column */}
                            <div className="flex flex-col gap-1 flex-1">
                                {/* Header: Machine + Status */}
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold font-display text-primary">{order.machine}</h3>
                                    <div className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                        order.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                    )}>
                                        {order.status}
                                    </div>
                                </div>

                                {/* Part Number */}
                                <p className="text-xs font-extrabold text-gray-800">{order.partNumber}</p>

                                {/* Operator */}
                                <p className="text-[11px] font-medium text-gray-400">{order.operator}</p>
                            </div>

                            {/* Right Column */}
                            <div className="flex flex-col items-end gap-3 justify-center min-h-[48px]">
                                {/* Target Badge */}
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100/80 px-2 py-1 rounded-md tracking-tight">
                                    Target: {order.target}
                                </span>

                                {/* ID Badge */}
                                <span className="text-[10px] font-bold text-primary/80 bg-[#F0F4F8] px-2 py-1 rounded-md tracking-tight">
                                    {order.id}
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
