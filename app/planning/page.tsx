"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import DateNavigator from '@/components/DateNavigator';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function PlanningPage() {
    const { orders, currentDate, setCurrentDate, deleteOrder } = useData();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterMachine, setFilterMachine] = useState('All');
    const [showFilters, setShowFilters] = useState(false);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const formatDateForDisplay = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }).toUpperCase();
    };



    // Filter Logic
    const filteredAssignments = orders.filter(item => {
        // Filter by Date
        if (item.date !== currentDate) return false;

        const matchesSearch =
            item.machine.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.id.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
        const matchesMachine = filterMachine === 'All' || item.machine === filterMachine;

        // Hide COMPLETED items during Delete Mode
        // because users can only delete non-completed plans
        const matchesDeleteMode = !isDeleteMode || item.status !== 'COMPLETED';

        return matchesSearch && matchesStatus && matchesMachine && matchesDeleteMode;
    });

    // Selection Logic
    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBatchDeleteClick = () => {
        if (selectedIds.length === 0) return;
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        selectedIds.forEach(id => deleteOrder(id));
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

            <AppHeader title="Planning" />

            {/* Sticky Controls Container */}
            <div className="sticky top-[68px] z-20 bg-background-dashboard pb-3 px-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.1)]">

                {/* Date Navigator */}
                {/* Date Navigator */}
                <div className={cn("pt-1 pb-0 transition-opacity", isDeleteMode ? "opacity-50 pointer-events-none" : "opacity-100")}>
                    <DateNavigator
                        currentDate={currentDate}
                        setCurrentDate={setCurrentDate}
                        disabled={isDeleteMode}
                    />
                </div>

                {/* Search & Filter Row */}
                <div className="flex gap-2.5">
                    <div className="flex-1 relative">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">search</span>
                        <input
                            type="text"
                            placeholder="Search assignments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary/50 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "size-[46px] flex items-center justify-center rounded-xl border shadow-sm transition-colors shrink-0",
                            showFilters ? "bg-primary border-primary text-white" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                        )}
                    >
                        <span className="material-symbols-outlined text-[22px]">filter_list</span>
                    </button>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="mt-3 animate-in slide-in-from-top-1 fade-in duration-200 space-y-3">
                        {/* Status Filter */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Status</p>
                            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                                {['All', 'PLANNED', 'COMPLETED'].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap",
                                            filterStatus === status
                                                ? "bg-primary border-primary text-white"
                                                : "bg-white border-gray-200 text-primary/70 hover:text-primary"
                                        )}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Machine Filter */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Machine</p>
                            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                                {['All', ...Array.from(new Set(orders.map(o => o.machine))).sort()].map(machine => (
                                    <button
                                        key={machine}
                                        onClick={() => setFilterMachine(machine)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap",
                                            filterMachine === machine
                                                ? "bg-primary border-primary text-white"
                                                : "bg-white border-gray-200 text-primary/70 hover:text-primary"
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
                {filteredAssignments.map(item => (
                    <Link
                        key={item.id}
                        href={isDeleteMode ? '#' : `/planning/edit/${encodeURIComponent(item.id)}`}
                        className={cn(
                            "block bg-white rounded-xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all relative overflow-hidden",
                            isDeleteMode ? "cursor-default" : "active:scale-[0.99] hover:border-gray-300 border-card-border",
                            selectedIds.includes(item.id) ? "border-red-500 bg-red-50/30" : "border-card-border"
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
                            <div className="flex flex-col gap-1 flex-1">
                                {/* Header: Machine + Status */}
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold font-display text-primary">{item.machine}</h3>
                                    <div className={cn(
                                        "size-2 rounded-full",
                                        item.status === 'PLANNED' ? "bg-amber-400" :
                                            item.status === 'COMPLETED' ? "bg-emerald-500" : "bg-gray-300"
                                    )}></div>
                                </div>

                                {/* Part Number */}
                                <p className="text-xs font-extrabold text-gray-800">{item.partNumber}</p>

                                {/* Operator */}
                                <p className="text-[11px] font-medium text-gray-400">{item.operator}</p>
                            </div>

                            {/* Right Column: Info OR Radio Selection */}
                            <div className="flex flex-col items-end gap-3 justify-center min-h-[48px]">
                                {isDeleteMode ? (
                                    <div className={cn(
                                        "size-6 rounded-full border-[1.5px] flex items-center justify-center transition-all",
                                        selectedIds.includes(item.id)
                                            ? "border-red-500 bg-red-50"
                                            : "border-gray-300 bg-white"
                                    )}>
                                        {selectedIds.includes(item.id) && (
                                            <div className="size-3.5 rounded-full bg-red-500 shadow-sm animate-in zoom-in-75 duration-200" />
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {/* Time Badge */}
                                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100/80 px-2 py-1 rounded-md tracking-tight">
                                            {item.startTime} - {item.endTime}
                                        </span>

                                        {/* WO Badge */}
                                        <span className="text-[10px] font-bold text-primary/80 bg-[#F0F4F8] px-2 py-1 rounded-md tracking-tight">
                                            {item.id}
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
                        <div className="size-20 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center mb-4 rotate-3">
                            <span className="material-symbols-outlined text-[32px] text-gray-300">event_note</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-1.5">No Plans Found</h3>
                        <p className="text-xs font-medium text-gray-400 text-center max-w-[200px] leading-relaxed">
                            No assignments scheduled for <br /><span className="text-primary font-bold mt-1 block">{formatDateForDisplay(currentDate)}</span>
                        </p>
                    </div>
                )}
            </main>

            {/* Floating Action Buttons */}
            <div className="fixed bottom-24 right-5 z-40 flex flex-col items-center gap-3">

                {/* Confirm Delete FAB */}
                {isDeleteMode && selectedIds.length > 0 && (
                    <button
                        onClick={handleBatchDeleteClick}
                        className="size-14 rounded-full bg-red-500 shadow-[0_4px_14px_rgba(239,68,68,0.4)] flex items-center justify-center text-white active:scale-95 transition-all animate-in zoom-in-50 duration-200"
                    >
                        <span className="material-symbols-outlined text-[32px]">check</span>
                    </button>
                )}

                {/* Create FAB (Normal Mode) */}
                {!isDeleteMode && (
                    <Link
                        href="/planning/create"
                        className="size-14 rounded-full bg-primary shadow-[0_4px_14px_rgba(0,0,0,0.25)] flex items-center justify-center text-white active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined text-[32px]">add</span>
                    </Link>
                )}

                {/* Toggle Delete Mode FAB */}
                <button
                    onClick={toggleDeleteMode}
                    className={cn(
                        "rounded-full shadow-lg flex items-center justify-center transition-all duration-300 bg-white border border-gray-100",
                        isDeleteMode
                            ? "size-10 text-gray-500 hover:text-gray-800"
                            : "size-10 text-gray-400 hover:text-red-500"
                    )}
                    title={isDeleteMode ? "Cancel" : "Delete Assignments"}
                >
                    <span className={cn("material-symbols-outlined", isDeleteMode ? "text-[22px]" : "text-[20px]")}>
                        {isDeleteMode ? "close" : "delete"}
                    </span>
                </button>
            </div>

            {/* Custom Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[320px] p-6 animate-in zoom-in-95 duration-200 border border-white/20">
                        <div className="size-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4 mx-auto">
                            <span className="material-symbols-outlined text-[28px]">delete</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 text-center font-display">Delete Assignments?</h3>
                        <p className="text-xs font-medium text-gray-500 mb-6 text-center leading-relaxed">
                            Are you sure you want to delete <strong className="text-gray-800">{selectedIds.length}</strong> selected assignments? <br />This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 h-11 flex items-center justify-center rounded-xl bg-gray-50 text-gray-600 font-bold text-xs hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 h-11 flex items-center justify-center rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 shadow-[0_4px_12px_rgba(239,68,68,0.3)] transition-all active:scale-95"
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
