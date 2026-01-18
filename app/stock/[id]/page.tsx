"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AssignmentDetailsCard, { AssignmentFormData } from '@/components/AssignmentDetailsCard';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

function StockEntryForm() {
    const router = useRouter();
    const params = useParams();
    // In strict Edit Mode, ID is required from URL parameters
    const rawId = params?.id;
    const idString = Array.isArray(rawId) ? rawId[0] : rawId;
    const orderId = idString ? decodeURIComponent(idString) : "";

    // Always strict edit mode
    const isEditMode = true;

    const { getOrderById, updateOrder } = useData();

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any>(null);

    // Completion Form State
    const [actualOutput, setActualOutput] = useState(0);
    const [toolChanges, setToolChanges] = useState(0);
    const [rejects, setRejects] = useState(0);
    const [actualStartTime, setActualStartTime] = useState("");
    const [actualEndTime, setActualEndTime] = useState("");
    const [remarks, setRemarks] = useState("");
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Read-only Details State
    const [formData, setFormData] = useState<AssignmentFormData>({
        machine: "",
        operator: "",
        date: "",
        shift: "",
        startTime: "",
        endTime: "",
        code: "",
        partNumber: "",
        workOrderId: "",
        opNumber: 0,
        batch: 0,
        estTime: "",
        estUnit: "min"
    });

    useEffect(() => {
        if (orderId) {
            const data = getOrderById(orderId);
            if (data) {
                setOrder(data);

                // Pre-fill completion data if it exists
                setActualOutput(data.actualOutput || 0);
                setToolChanges(data.toolChanges || 0);
                setRejects(data.rejects || 0);
                setActualStartTime(data.actualStartTime || data.startTime || "");
                setActualEndTime(data.actualEndTime || data.endTime || "");
                setRemarks(data.remarks || "");

                // Initialize form data for the Details Card (Read-only view)
                let estTime = "0";
                let estUnit = "min";
                const est = data.estPart || "0m";
                if (est.endsWith('h')) {
                    estTime = est.replace('h', '');
                    estUnit = 'hr';
                } else {
                    estTime = est.replace('m', '');
                    estUnit = 'min';
                }

                setFormData({
                    machine: data.machine,
                    operator: data.operator,
                    date: data.date,
                    shift: data.shift,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    code: data.code,
                    partNumber: data.partNumber,
                    workOrderId: data.id,
                    opNumber: data.opNumber,
                    batch: data.batch,
                    estTime,
                    estUnit
                });

            } else {
                toast.error("Order not found");
                router.push('/stock');
            }
        } else {
            // Should not happen in strict [id] route unless manual navigation
            toast.error("Invalid Order ID");
            router.push('/stock');
        }
        setLoading(false);
    }, [orderId, getOrderById, router]);

    if (loading) return null;

    if (!order) return null;

    // Derived Values
    const target = order.target || 1;
    const efficiency = Math.round((actualOutput / target) * 100);
    const visualEfficiency = Math.min(efficiency, 100);
    const progressPercent = Math.min((actualOutput / target) * 100, 100);

    const handleSave = () => {
        if (orderId) {
            updateOrder(orderId, {
                status: 'COMPLETED',
                actualOutput,
                toolChanges,
                rejects,
                actualStartTime,
                actualEndTime,
                remarks
            });
            toast.success("Order completed successfully");
            router.push('/stock');
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard font-display">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-[var(--header-height)] px-4 py-2">
                <div className="flex items-center justify-between h-full">
                    <div className="flex flex-col">
                        <h2 className="header-title">Complete Order</h2>
                        <p className="header-subtitle mt-0.5 uppercase block">Inventory</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform"
                        >
                            SAVE
                        </button>
                    </div>
                </div>
            </header>

            <main className="!p-4 !space-y-6 !pb-24">

                {/* 1. Key Info - Context Aware (Standard Card) */}
                <section className="grid grid-cols-3 !gap-2">
                    <div className="bg-white !rounded-lg border border-gray-100 shadow-sm !px-3 !py-1.5 flex flex-col justify-center items-start min-h-[52px]">
                        <p className="!text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Part Number</p>
                        <p className="text-xs font-bold text-gray-800 leading-tight break-all">{order.partNumber}</p>
                    </div>
                    <div className="bg-white !rounded-lg border border-gray-100 shadow-sm !px-3 !py-1.5 flex flex-col justify-center items-start min-h-[52px]">
                        <p className="!text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Order ID</p>
                        <p className="text-xs font-bold text-gray-800 leading-tight break-all">{order.id}</p>
                    </div>
                    <div className="bg-white !rounded-lg border border-gray-100 shadow-sm !px-3 !py-1.5 flex flex-col justify-center items-start min-h-[52px]">
                        <p className="!text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Date</p>
                        <p className="text-xs font-bold text-gray-800 leading-tight">
                            {new Date(order.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                </section>

                {/* 2. Efficiency / Performance Section */}
                <section className="bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-gray-50/80 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-primary">PRODUCTION Efficiency</h3>
                        <span className="material-symbols-outlined text-gray-400 !text-lg">monitoring</span>
                    </div>

                    <div className="!p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-gray-800 tracking-tight">{efficiency}%</span>
                                    <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-500">
                                        <span className="material-symbols-outlined !text-[10px]">trending_down</span>
                                        20u
                                    </div>
                                </div>
                                <p className="!text-[9px] font-medium text-gray-500 mt-0.5 uppercase tracking-wide">Based on EST {order.estPart}</p>
                            </div>

                            {/* Radial Progress */}
                            <div className="relative size-10 flex-shrink-0">
                                <div
                                    className="radial-progress absolute inset-0 rounded-full text-primary"
                                    style={{ "--value": visualEfficiency, "--size": "2.5rem", "--thickness": "3px" } as React.CSSProperties}
                                ></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary !text-lg">factory</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between !text-[9px] font-medium uppercase tracking-wider mb-1">
                                <span className="text-gray-500">Progress</span>
                                <span className="text-gray-800">{actualOutput} / {order.target}</span>
                            </div>
                            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Production Input Form */}
                <section className="bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-primary">Production Input</h3>
                        <span className="material-symbols-outlined text-gray-400 !text-lg">input</span>
                    </div>

                    <div className="!p-4 !space-y-4">

                        {/* Actual Shift Timings - Badge Style (No outer label) */}
                        <div className="flex !gap-2 bg-primary/5 !p-3 rounded-lg border border-primary/10 transition-colors">
                            <div className="flex-1 flex flex-col justify-center">
                                <p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">Actual Start</p>
                                <input
                                    type="time"
                                    value={actualStartTime}
                                    onChange={(e) => setActualStartTime(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto"
                                />
                            </div>
                            <div className="w-px bg-primary/20"></div>
                            <div className="flex-1 flex flex-col justify-center">
                                <p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">Actual End</p>
                                <input
                                    type="time"
                                    value={actualEndTime}
                                    onChange={(e) => setActualEndTime(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto"
                                />
                            </div>
                        </div>

                        {/* Counters Grid - 3 Columns matching 'Op/Batch/Est' density */}
                        <div className="grid grid-cols-3 !gap-2">
                            {/* Actual Output */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Output (Good)</label>
                                <div className="flex items-center h-9 bg-gray-50 !rounded-lg border border-gray-200 overflow-hidden">
                                    <button
                                        onClick={() => setActualOutput(prev => Math.max(0, prev - 1))}
                                        className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-100 active:bg-gray-200 transition-colors border-r border-gray-200"
                                    >
                                        <span className="material-symbols-outlined !text-lg">remove</span>
                                    </button>
                                    <div className="flex-1 h-full bg-white flex items-center justify-center">
                                        <input
                                            className="w-full text-center !text-sm font-bold text-gray-800 border-none focus:ring-0 p-0 no-spin-button bg-transparent"
                                            placeholder="0"
                                            type="number"
                                            value={actualOutput}
                                            onChange={(e) => setActualOutput(Number(e.target.value))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setActualOutput(prev => prev + 1)}
                                        className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-100 active:bg-gray-200 transition-colors border-l border-gray-200"
                                    >
                                        <span className="material-symbols-outlined !text-lg">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* Tool Changes */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Tool Changes</label>
                                <div className="flex items-center h-9 bg-gray-50 !rounded-lg border border-gray-200 overflow-hidden">
                                    <button
                                        onClick={() => setToolChanges(prev => Math.max(0, prev - 1))}
                                        className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-100 active:bg-gray-200 transition-colors border-r border-gray-200"
                                    >
                                        <span className="material-symbols-outlined !text-lg">remove</span>
                                    </button>
                                    <div className="flex-1 h-full bg-white flex items-center justify-center">
                                        <input
                                            className="w-full text-center !text-sm font-bold text-gray-800 border-none focus:ring-0 p-0 no-spin-button bg-transparent"
                                            type="number"
                                            value={toolChanges}
                                            onChange={(e) => setToolChanges(Number(e.target.value))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setToolChanges(prev => prev + 1)}
                                        className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-100 active:bg-gray-200 transition-colors border-l border-gray-200"
                                    >
                                        <span className="material-symbols-outlined !text-lg">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* Rejects */}
                            <div className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Rejects</label>
                                <div className="flex items-center h-9 bg-gray-50 !rounded-lg border border-gray-200 overflow-hidden">
                                    <button
                                        onClick={() => setRejects(prev => Math.max(0, prev - 1))}
                                        className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-100 active:bg-gray-200 transition-colors border-r border-gray-200"
                                    >
                                        <span className="material-symbols-outlined !text-lg">remove</span>
                                    </button>
                                    <div className="flex-1 h-full bg-white flex items-center justify-center">
                                        <input
                                            className="w-full text-center !text-sm font-bold text-red-500 border-none focus:ring-0 p-0 no-spin-button bg-transparent"
                                            type="number"
                                            value={rejects}
                                            onChange={(e) => setRejects(Number(e.target.value))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setRejects(prev => prev + 1)}
                                        className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-100 active:bg-gray-200 transition-colors border-l border-gray-200"
                                    >
                                        <span className="material-symbols-outlined !text-lg">add</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Remarks */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-gray-500 uppercase ml-1">Remarks <span className="font-normal text-gray-400 normal-case">(optional)</span></label>
                            <textarea
                                className="w-full bg-gray-50 border border-gray-200 !rounded-lg !p-3 !text-xs font-medium text-gray-800 focus:ring-primary focus:border-primary resize-none h-20 placeholder:text-gray-400"
                                placeholder="Enter production notes..."
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                </section>

                {/* 4. Planned Order Details (Collapsible) - Context Aware */}
                <div className="bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                        onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                        className="w-full bg-gray-50/80 !px-4 !py-3 border-b border-gray-100 flex justify-between items-center active:bg-gray-50 transition-colors"
                    >
                        <h3 className="font-bold text-sm uppercase tracking-wider text-primary">Planned Order Details</h3>
                        <span className={`material-symbols-outlined text-gray-400 !text-lg transition-transform duration-300 ${isDetailsOpen ? 'rotate-180' : ''}`}>
                            expand_more
                        </span>
                    </button>
                    {isDetailsOpen && (
                        <div className="animate-in slide-in-from-top-2 duration-200 bg-white">
                            <AssignmentDetailsCard
                                title="Planned Details"
                                icon="assignment"
                                data={formData}
                                onChange={() => { }}
                                readOnly={true}
                                hideHeader={true}
                            />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function StockCreatePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <StockEntryForm />
        </Suspense>
    );
}
