'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Mock Data
const WORK_ORDERS = [
    {
        id: '1',
        woNumber: 'WO-55400',
        partNumber: 'P-1022',
        machine: 'CNC-01',
        status: 'Running',
        progress: 78,
        qty: '390/500',
        startTime: '08:00 AM'
    },
    {
        id: '2',
        woNumber: 'WO-55401',
        partNumber: 'P-3341',
        machine: 'CNC-02',
        status: 'Paused',
        progress: 45,
        qty: '120/400',
        startTime: '09:30 AM'
    },
    {
        id: '3',
        woNumber: 'WO-55403',
        partNumber: 'P-9001',
        machine: 'CNC-01',
        status: 'Scheduled',
        progress: 0,
        qty: '0/200',
        startTime: '02:00 PM'
    },
    {
        id: '4',
        woNumber: 'WO-55399',
        partNumber: 'P-1055-B',
        machine: 'LATHE-05',
        status: 'Completed',
        progress: 100,
        qty: '150/150',
        startTime: 'Yesterday'
    },
];

export default function WorkOrderList() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('Active');

    const filteredOrders = activeTab === 'All'
        ? WORK_ORDERS
        : WORK_ORDERS.filter(wo => {
            if (activeTab === 'Active') return ['Running', 'Paused'].includes(wo.status);
            if (activeTab === 'Scheduled') return wo.status === 'Scheduled';
            if (activeTab === 'History') return wo.status === 'Completed';
            return true;
        });

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard">

            {/* Header */}
            <header className="px-5 pt-12 pb-6 flex items-center gap-4 bg-white border-b border-gray-200 sticky top-0 z-10">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 flex items-center justify-center rounded-xl border border-card-border text-primary hover:bg-gray-50 transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">arrow_back</span>
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-bold text-gray-400 tracking-wide">MANUFACTURING</span>
                        <span className="material-symbols-outlined text-[12px] text-gray-400">chevron_right</span>
                        <span className="text-[11px] font-bold text-gray-600 tracking-wide">WORK ORDERS</span>
                    </div>
                    <h1 className="text-xl font-bold font-display text-primary leading-tight">Active Work Orders</h1>
                </div>
            </header>

            {/* Filter Tabs */}
            <div className="px-5 py-4 flex gap-2 overflow-x-auto scrollbar-none sticky top-[105px] bg-[#F8FAFC] z-10">
                {['Active', 'Scheduled', 'History', 'All'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-4 py-2 rounded-full text-[13px] font-semibold transition-all border whitespace-nowrap",
                            activeTab === tab
                                ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                                : "bg-white border-card-border text-gray-500 hover:bg-gray-50"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* List Content */}
            <div className="flex-1 px-5 pb-8 space-y-4">
                {filteredOrders.map((item) => (
                    <Link
                        key={item.id}
                        href={`/work-order?id=${item.id}&wo=${item.woNumber}`}
                        className="block bg-white rounded-2xl p-4 border border-card-border card-shadow active:scale-[0.98] transition-transform"
                    >
                        {/* Card Header */}
                        <div className="flex justify-between items-start mb-3">
                            <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold",
                                item.status === 'Running' ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                            )}>
                                {item.status === 'Running' ?
                                    <span className="material-symbols-outlined text-[14px] animate-spin-slow">settings</span> :
                                    <span className="material-symbols-outlined text-[14px]">pause_circle</span>
                                }
                                <span>{item.machine}</span>
                            </div>

                            <div className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider",
                                item.status === 'Running' ? "bg-emerald-50 text-emerald-600" :
                                    item.status === 'Paused' ? "bg-amber-50 text-amber-600" :
                                        item.status === 'Completed' ? "bg-emerald-50 text-emerald-600" :
                                            "bg-gray-100 text-gray-500"
                            )}>
                                {item.status}
                            </div>
                        </div>

                        {/* Card Body */}
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h3 className="text-sm font-bold font-display text-primary mb-0.5">{item.woNumber}</h3>
                                <p className="text-[11px] font-medium text-gray-500">{item.partNumber}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold font-display text-primary">{item.qty}</p>
                                <p className="text-[11px] font-medium text-gray-400">{item.progress}% Complete</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                            <div
                                className={cn("h-full rounded-full transition-all duration-500",
                                    item.status === 'Completed' ? "bg-emerald-500" :
                                        item.status === 'Paused' ? "bg-amber-500" :
                                            "bg-primary"
                                )}
                                style={{ width: `${item.progress}%` }}
                            />
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center gap-1.5 text-gray-400 text-[11px] font-medium">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            <span>Started: {item.startTime}</span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
