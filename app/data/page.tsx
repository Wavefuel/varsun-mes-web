"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import DateNavigator from '@/components/DateNavigator';
import SearchFilterBar from '@/components/SearchFilterBar';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useData } from '@/context/DataContext';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Helper for deterministic random numbers
function getPseudoRandom(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// Enhanced Machine Type
interface Machine {
    id: string;
    name: string;
    model: string;
    serialNumber: string;
    ipAddress: string;
    location: string;
}

const MACHINE_INVENTORY: Machine[] = [
    { id: 'CNC-01', name: 'Vertical Mill A', model: 'VF-2SS', serialNumber: 'SN-2023-8842', ipAddress: '192.168.1.101', location: 'Section A' },
    { id: 'CNC-02', name: 'Lathe Station', model: 'ST-20', serialNumber: 'SN-2023-9102', ipAddress: '192.168.1.102', location: 'Section A' },
    { id: 'CNC-03', name: 'Precision Mill', model: 'UMC-750', serialNumber: 'SN-2022-4421', ipAddress: '192.168.1.105', location: 'Section B' },
    { id: 'ROBOT-01', name: 'Assembly Arm', model: 'KR-10', serialNumber: 'RB-9921-X', ipAddress: '192.168.1.201', location: 'Assembly' },
    { id: 'PRESS-A1', name: 'Hydraulic Press', model: 'H-Frame 50T', serialNumber: 'PR-5520-22', ipAddress: '192.168.1.150', location: 'Forming' },
];

export default function EventsPage() {
    const { currentDate, setCurrentDate } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Filter Logic
    const filteredMachines = MACHINE_INVENTORY.filter(m => {
        const query = searchQuery.toLowerCase();
        return (
            m.name.toLowerCase().includes(query) ||
            m.id.toLowerCase().includes(query) ||
            m.serialNumber.toLowerCase().includes(query)
        );
    });

    // Helper to generate dynamic status based on machine + date
    const getMachineStatus = (machineId: string, date: string) => {
        const rand = getPseudoRandom(machineId + date);
        const untaggedCount = rand % 25; // 0 to 24

        // Simulate different states based on random seed
        const statusTypes = ['Running', 'Idle', 'Maintenance', 'Offline'];
        // Bias towards 'Running'
        const statusIndex = (rand % 10) > 6 ? (rand % 4) : 0;
        const status = statusTypes[statusIndex];

        // Connection strength (1-3)
        const connectionParams = {
            signal: 80 + (rand % 20), // 80-99%
            ping: 12 + (rand % 40) // 12-52ms
        };

        return { untaggedCount, status, ...connectionParams };
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard pb-24">
            <AppHeader title="Events" subtitle="Device Metrics" />

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
                    placeholder="Search machines..."
                    showFilters={showFilters}
                    onToggleFilters={() => setShowFilters(!showFilters)}
                />
            </div>

            {/* Machines List */}
            <main className="px-4 space-y-3 pt-2">
                {filteredMachines.map((machine) => {
                    const { untaggedCount, status, signal } = getMachineStatus(machine.id, currentDate);
                    const isOnline = status !== 'Offline';

                    return (
                        <Link
                            key={machine.id}
                            href={`/data/${encodeURIComponent(machine.id)}`}
                            className="list-card card-shadow"
                        >
                            <div className="flex justify-between items-start gap-4">
                                {/* Left Column */}
                                <div className="flex flex-col gap-0.5 flex-1">
                                    {/* Primary ID + Status Dot */}
                                    <div className="flex items-center gap-2">
                                        <h3 className="list-title">{machine.id}</h3>
                                        <div className={cn(
                                            "size-2 rounded-full",
                                            status === 'Running' ? "bg-emerald-500" :
                                                status === 'Idle' ? "bg-amber-500" :
                                                    status === 'Maintenance' ? "bg-blue-500" : "bg-gray-300"
                                        )} />
                                    </div>

                                    {/* Secondary Name */}
                                    <p className="list-subtext">{machine.name} • {machine.model}</p>

                                    {/* Serial Number */}
                                    <p className="list-subtext">{machine.serialNumber}</p>
                                </div>

                                {/* Right Column: Just the Call-to-action Metric */}
                                <div className="list-metric-column">
                                    <span className={cn(
                                        "list-tag",
                                        untaggedCount > 0
                                            ? "text-amber-700 bg-amber-50"
                                            : "text-emerald-700 bg-emerald-50"
                                    )}>
                                        {untaggedCount} Untagged
                                    </span>
                                </div>
                            </div>
                        </Link>
                    );
                })}

                {/* Empty State */}
                {filteredMachines.length === 0 && (
                    <div className="text-center py-12 flex flex-col items-center opacity-60">
                        <span className="material-symbols-outlined text-[48px] text-gray-300 mb-2">dns</span>
                        <p className="text-sm font-bold text-gray-400">No matching machines found</p>
                    </div>
                )}
            </main>
        </div>
    );
}
