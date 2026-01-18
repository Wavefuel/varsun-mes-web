"use client";

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useData } from '@/context/DataContext';
import DateNavigator from '@/components/DateNavigator';
import SearchFilterBar from '@/components/SearchFilterBar';

export default function MachineTaggingPage() {
    const router = useRouter();
    const params = useParams();
    const { currentDate, setCurrentDate } = useData();
    // decodeURIComponent in case ID has spaces or special chars
    const machineId = typeof params.id === 'string' ? decodeURIComponent(params.id) : 'Unknown Machine';

    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Mock Data State
    const [stats] = useState({
        untaggedCount: 45,
        untaggedUnit: 'min',
        totalIdle: '2h 10m',
        totalOffline: '15',
        totalOfflineUnit: 'min'
    });

    // Mock Events Data
    const [events] = useState([
        { id: 'ev-101', machineId: 'CNC-01', date: currentDate, startTime: '10:30', endTime: '10:45', duration: '15m', type: 'Untagged' },
        { id: 'ev-102', machineId: 'LATHE-05', date: currentDate, startTime: '08:00', endTime: '08:20', duration: '20m', type: 'Offline' },
        { id: 'ev-103', machineId: 'CNC-02', date: currentDate, startTime: '09:15', endTime: '09:45', duration: '30m', type: 'Logged', reason: 'Tool Change' },
        // History event to test date navigation
        { id: 'ev-099', machineId: 'CNC-01', date: '2025-01-01', startTime: '14:00', endTime: '14:20', duration: '20m', type: 'Logged', reason: 'Maintenance' },
    ]);

    // Filter Logic
    const filteredEvents = events.filter(e => {
        const isDateMatch = e.date === currentDate;
        const isSearchMatch =
            e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.reason && e.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
            e.startTime.includes(searchQuery);

        return isDateMatch && isSearchMatch;
    });

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard font-display pb-24 text-slate-800">

            {/* Standard Context Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-[var(--header-height)] px-4 py-2">
                <div className="flex items-center justify-between h-full">
                    <div className="flex flex-col">
                        <h2 className="header-title">{machineId}</h2>
                        <p className="header-subtitle mt-0.5 uppercase block">Downtime Events</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-md mx-auto relative px-4">

                {/* Page Controls (Date + Search) */}
                <div className="pt-4 pb-1 space-y-3">
                    <DateNavigator
                        currentDate={currentDate}
                        setCurrentDate={setCurrentDate}
                    />

                    <SearchFilterBar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        placeholder="Search events..."
                        showFilters={showFilters}
                        onToggleFilters={() => setShowFilters(!showFilters)}
                    />
                </div>

                {/* Stats Grid */}
                <section className="pt-4 pb-2">
                    <div className="grid grid-cols-3 gap-2">
                        {/* Untagged Card */}
                        <div className="bg-white border border-gray-100 rounded-xl px-2 py-3 flex flex-col items-center justify-center gap-1.5 shadow-sm min-h-[90px]">
                            <div className="size-6 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
                                <span className="material-symbols-outlined !text-[14px] font-bold">priority_high</span>
                            </div>
                            <div className="text-center w-full">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 truncate">Untagged</p>
                                <p className="text-gray-900 text-sm font-bold leading-none">
                                    {stats.untaggedCount} <span className="text-[10px] font-medium text-gray-400">{stats.untaggedUnit}</span>
                                </p>
                            </div>
                        </div>

                        {/* Total Idle Card */}
                        <div className="bg-white border border-gray-100 rounded-xl px-2 py-3 flex flex-col items-center justify-center gap-1.5 shadow-sm min-h-[90px]">
                            <div className="size-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                                <span className="material-symbols-outlined !text-[14px]">hourglass_empty</span>
                            </div>
                            <div className="text-center w-full">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 truncate">Total Idle</p>
                                <p className="text-gray-900 text-sm font-bold leading-none">{stats.totalIdle}</p>
                            </div>
                        </div>

                        {/* Total Offline Card */}
                        <div className="bg-white border border-gray-100 rounded-xl px-2 py-3 flex flex-col items-center justify-center gap-1.5 shadow-sm min-h-[90px]">
                            <div className="size-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                                <span className="material-symbols-outlined !text-[14px]">power_off</span>
                            </div>
                            <div className="text-center w-full">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 truncate">Offline</p>
                                <p className="text-gray-900 text-sm font-bold leading-none">
                                    {stats.totalOffline} <span className="text-[10px] font-medium text-gray-400">{stats.totalOfflineUnit}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Event List */}
                <div className="space-y-3 mt-4 pb-24">
                    <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Detected Events</h2>

                    {filteredEvents.length > 0 ? (
                        filteredEvents.map((event) => {
                            const isLogged = event.type === 'Logged';
                            const isUntagged = event.type === 'Untagged';

                            // Determine display title and subtitle
                            const displayTitle = event.reason || event.type;

                            return (
                                <Link
                                    key={event.id}
                                    href={`/data/${encodeURIComponent(machineId)}/tag/${event.id}`}
                                    className="block bg-white rounded-xl border border-gray-100 p-4 shadow-sm transition-all relative overflow-hidden active:scale-[0.99] hover:border-gray-200"
                                >
                                    <div className="flex justify-between items-center gap-4">
                                        {/* Left Column: Type & Time */}
                                        <div className="flex flex-col gap-1.5 flex-1">
                                            {/* Header */}
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-gray-800 tracking-tight">{event.type}</h3>

                                                {/* Badge */}
                                                <div className={cn(
                                                    "px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider",
                                                    isUntagged ? "bg-orange-50 text-orange-600" :
                                                        isLogged ? "bg-gray-100 text-gray-500" :
                                                            "bg-red-50 text-red-600"
                                                )}>
                                                    {isUntagged ? 'Requires Action' : event.type === 'Offline' ? 'System Offline' : 'Logged'}
                                                </div>
                                            </div>

                                            {/* Subtitle / Reason if logged */}
                                            {isLogged && event.reason && (
                                                <p className="text-xs font-semibold text-gray-600">{event.reason}</p>
                                            )}

                                            {/* Time & Duration */}
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined !text-[12px]">schedule</span>
                                                    {event.startTime} - {event.endTime}
                                                </span>
                                                <span className="size-0.5 rounded-full bg-gray-300" />
                                                <span className="text-gray-500 font-bold">{event.duration}</span>
                                            </div>
                                        </div>

                                        {/* Right Column: Chevron */}
                                        <div className="flex items-center text-gray-300">
                                            <span className="material-symbols-outlined !text-[20px]">chevron_right</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    ) : (
                        <div className="text-center py-12 flex flex-col items-center opacity-60">
                            <span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">event_busy</span>
                            <p className="text-sm font-bold text-gray-400">No events found for this date</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
