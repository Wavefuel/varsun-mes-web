"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function StockOrderPage() {
    const router = useRouter();
    const params = useParams();
    const { getOrderById, updateOrder } = useData();

    // Handle array or string param
    const rawId = params?.id;
    const idString = Array.isArray(rawId) ? rawId[0] : rawId;
    const orderId = idString ? decodeURIComponent(idString) : "";

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<any>(null); // Using any temporarily for flexibility, but ideally Order type

    // Form State
    const [actualOutput, setActualOutput] = useState(0);
    const [toolChanges, setToolChanges] = useState(0);
    const [rejects, setRejects] = useState(0);
    const [remarks, setRemarks] = useState("");

    useEffect(() => {
        if (orderId) {
            const data = getOrderById(orderId);
            if (data) {
                setOrder(data);
                setActualOutput(data.actualOutput || 0);
                setToolChanges(data.toolChanges || 0);
                setRejects(data.rejects || 0);
                setRemarks(data.remarks || "");
            } else {
                // If order not found, maybe show error but for now just redirect or stay
                // We'll handle inline
            }
            setLoading(false);
        }
    }, [orderId, getOrderById]);

    if (loading) return null;

    if (!order) {
        return (
            <div className="flex flex-col min-h-screen bg-background-dashboard items-center justify-center p-4">
                <button onClick={() => router.back()} className="mb-4 text-gray-500 flex items-center gap-2">
                    <span className="material-symbols-outlined">arrow_back</span> Back
                </button>
                <p className="text-gray-400 font-bold">Order not found.</p>
            </div>
        );
    }

    // Derived Values
    const target = order.target || 1; // Avoid division by zero
    const efficiency = Math.min(Math.round((actualOutput / target) * 100), 100);
    const progressPercent = Math.min((actualOutput / target) * 100, 100);

    const handleSave = () => {
        updateOrder(orderId, {
            status: 'COMPLETED',
            actualOutput,
            toolChanges,
            rejects,
            remarks
        });
        toast.success("Order updated successfully");
        router.push('/stock'); // Go back to stock list
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard">
            {/* Header - Matching Create/Edit Assignment Page */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="flex items-center px-4 py-3 justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.back()} className="flex items-center justify-center -ml-1">
                            <span className="material-symbols-outlined text-primary text-2xl">arrow_back</span>
                        </button>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold leading-none mb-0.5">Stock</p>
                            <h2 className="text-base font-bold leading-tight tracking-tight text-[#131516]">Complete Order</h2>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        className="bg-primary text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform"
                    >
                        SAVE
                    </button>
                </div>
            </header>

            <main className="p-3 space-y-4 pb-24 max-w-[480px] mx-auto">
                {/* 1. Key Order Info Card - Compact */}
                <section>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-2 flex flex-col justify-center items-center text-center min-h-[64px]">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 font-sans">Part Number</p>
                            <p className="text-xs font-bold text-gray-800 leading-tight px-1 break-all font-sans">{order.partNumber}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-2 flex flex-col justify-center items-center text-center min-h-[64px]">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 font-sans">Target</p>
                            <p className="text-sm font-bold text-gray-800 leading-tight font-sans">{order.target} <span className="text-[9px] text-gray-400 font-normal font-sans">pcs</span></p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-2 flex flex-col justify-center items-center text-center min-h-[64px]">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 font-sans">Date</p>
                            <p className="text-xs font-bold text-gray-800 leading-tight font-sans">
                                {new Date(order.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Efficiency / Performance Section - Compact */}
                <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-gray-50/80 px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-[11px] uppercase tracking-wider text-primary font-sans">Efficiency Metrics</h3>
                        <span className="material-symbols-outlined text-gray-400 text-[18px]">monitoring</span>
                    </div>

                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-0.5 font-sans">Current Efficiency</h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-gray-800 tracking-tighter font-sans">{efficiency}%</span>
                                    <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 font-sans">
                                        <span className="material-symbols-outlined text-[10px]">trending_down</span>
                                        20u
                                    </div>
                                </div>
                                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-wide font-sans">Based on EST {order.estPart}</p>
                            </div>

                            {/* Radial Progress - Smaller */}
                            <div className="relative size-14 flex-shrink-0">
                                <div
                                    className="radial-progress absolute inset-0 rounded-full text-primary"
                                    style={{ "--value": efficiency, "--size": "3.5rem", "--thickness": "4px" } as React.CSSProperties}
                                ></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary text-[24px]">factory</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider mb-1.5 font-sans">
                                <span className="text-gray-400">Progress</span>
                                <span className="text-gray-800">{actualOutput} / {order.target}</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Production Input Form - Compact & Clean */}
                <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-white px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-[11px] uppercase tracking-wider text-primary font-sans">Production Input</h3>
                        <span className="material-symbols-outlined text-gray-400 text-[18px]">input</span>
                    </div>

                    <div className="p-4 space-y-5">
                        {/* Actual Output */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide font-sans">Actual Output (Good)</label>
                            <div className="flex items-center h-10 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                <button
                                    onClick={() => setActualOutput(prev => Math.max(0, prev - 1))}
                                    className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-primary active:bg-gray-200 transition-colors border-r border-gray-200"
                                >
                                    <span className="material-symbols-outlined text-[18px]">remove</span>
                                </button>
                                <div className="flex-1 h-full bg-white flex items-center justify-center">
                                    <input
                                        className="w-full text-center text-lg font-bold text-gray-800 border-none focus:ring-0 p-0 font-sans no-spin-button"
                                        placeholder="0"
                                        type="number"
                                        value={actualOutput}
                                        onChange={(e) => setActualOutput(Number(e.target.value))}
                                    />
                                </div>
                                <button
                                    onClick={() => setActualOutput(prev => prev + 1)}
                                    className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-primary active:bg-gray-200 transition-colors border-l border-gray-200"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                </button>
                            </div>
                        </div>

                        {/* Tool Changes & Rejects */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide font-sans">Tool Changes</label>
                                <div className="flex items-center h-9 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                    <button
                                        onClick={() => setToolChanges(prev => Math.max(0, prev - 1))}
                                        className="w-9 h-full flex items-center justify-center text-gray-500 hover:text-primary active:bg-gray-200 transition-colors border-r border-gray-200"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">remove</span>
                                    </button>
                                    <div className="flex-1 h-full bg-white flex items-center justify-center">
                                        <input
                                            className="w-full text-center text-sm font-bold text-gray-800 border-none focus:ring-0 p-0 font-sans no-spin-button"
                                            type="number"
                                            value={toolChanges}
                                            onChange={(e) => setToolChanges(Number(e.target.value))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setToolChanges(prev => prev + 1)}
                                        className="w-9 h-full flex items-center justify-center text-gray-500 hover:text-primary active:bg-gray-200 transition-colors border-l border-gray-200"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide font-sans">Rejects</label>
                                <div className="flex items-center h-9 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                    <button
                                        onClick={() => setRejects(prev => Math.max(0, prev - 1))}
                                        className="w-9 h-full flex items-center justify-center text-gray-500 hover:text-primary active:bg-gray-200 transition-colors border-r border-gray-200"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">remove</span>
                                    </button>
                                    <div className="flex-1 h-full bg-white flex items-center justify-center">
                                        <input
                                            className="w-full text-center text-sm font-bold text-red-500 border-none focus:ring-0 p-0 font-sans no-spin-button"
                                            type="number"
                                            value={rejects}
                                            onChange={(e) => setRejects(Number(e.target.value))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setRejects(prev => prev + 1)}
                                        className="w-9 h-full flex items-center justify-center text-gray-500 hover:text-primary active:bg-gray-200 transition-colors border-l border-gray-200"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">add</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Remarks */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide font-sans">Remarks <span className="font-normal text-gray-400 normal-case font-sans">(optional)</span></label>
                            <textarea
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-800 focus:ring-primary focus:border-primary resize-none h-20 font-sans placeholder:text-gray-400"
                                placeholder="Enter production notes..."
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
