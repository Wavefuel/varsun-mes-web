"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CompleteOrderPage() {
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
                toast.error("Order not found");
                router.push('/planning');
            }
            setLoading(false);
        }
    }, [orderId, getOrderById, router]);

    if (loading || !order) return null;

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
        toast.success("Order completed successfully");
        router.push('/planning');
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard">
            {/* Custom Header from reference */}
            <header className="flex-none bg-white border-b border-gray-200 shadow-sm z-30 sticky top-0">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <button
                        onClick={() => router.back()}
                        className="size-10 flex items-center justify-center rounded-lg hover:bg-gray-50 text-slate-600 border border-gray-200 transition-colors active:bg-gray-100"
                    >
                        <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                    </button>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <h1 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Work Order</h1>
                        <div className="text-slate-800 font-bold text-base leading-tight flex items-center gap-2">
                            {order.id}
                            <span className="text-gray-300 font-light">|</span>
                            {order.machine.split(' ')[0]}
                        </div>
                    </div>
                    <div className="flex flex-col items-end justify-center min-w-[40px]">
                        <div className="flex items-center gap-1.5 bg-blue-50/80 px-2 py-1 rounded-md border border-blue-100 shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wide leading-none">Active</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto pb-24">
                <div className="pb-6">
                    {/* Top Stats Cards */}
                    <section className="px-4 pt-5">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-center items-center text-center h-20">
                                <p className="text-[11px] text-slate-400 font-medium mb-1">Part Number</p>
                                <p className="text-slate-800 font-bold text-sm leading-tight truncate w-full px-1">{order.partNumber}</p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-center items-center text-center h-20">
                                <p className="text-[11px] text-slate-400 font-medium mb-1">Target Output</p>
                                <p className="text-slate-800 font-bold text-sm leading-tight">{order.target} <span className="text-[10px] font-normal text-slate-400">pcs</span></p>
                            </div>
                            <div className="bg-white border border-card-border rounded-lg p-3 card-shadow flex flex-col justify-center items-center text-center h-20">
                                <p className="text-[11px] text-slate-400 font-medium mb-1">Shift Date</p>
                                <p className="text-slate-800 font-bold text-sm leading-tight">
                                    {new Date(order.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </section>

                    <div className="px-4 space-y-5 mt-5">
                        {/* Efficiency Card */}
                        <div className="bg-white rounded-xl p-5 border border-card-border card-shadow relative overflow-hidden">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1">Efficiency</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-slate-800 tracking-tight">{efficiency}%</span>
                                        {/* Dynamic badge logic could be better, simplified for now */}
                                        <div className="flex items-center gap-0.5 text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                            <span className="material-symbols-outlined text-[14px]">trending_down</span>
                                            20u
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">Based on EST {order.estPart}</p>
                                </div>

                                {/* Radial Progress */}
                                <div className="relative size-16 flex-shrink-0 mr-1">
                                    <div
                                        className="radial-progress absolute inset-0 rounded-full"
                                        style={{ "--value": efficiency } as React.CSSProperties}
                                    ></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-[24px]">factory</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-medium mb-2">
                                    <span className="text-slate-400">Progress</span>
                                    <span className="text-slate-800">{actualOutput} / {order.target}</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-100">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Input Forms */}
                        <div className="space-y-5">
                            {/* Actual Output */}
                            <div className="space-y-2">
                                <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wide ml-0.5">Actual Output (Good)</label>
                                <div className="flex items-stretch h-12 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all group">
                                    <button
                                        onClick={() => setActualOutput(prev => Math.max(0, prev - 1))}
                                        className="w-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border-r border-gray-200 text-slate-400 hover:text-primary transition-colors flex items-center justify-center"
                                    >
                                        <span className="material-symbols-outlined text-[22px]">remove</span>
                                    </button>
                                    <input
                                        className="flex-1 bg-transparent text-center text-xl font-bold text-slate-800 border-none focus:ring-0 placeholder-gray-300 font-sans"
                                        placeholder="0"
                                        type="number"
                                        value={actualOutput}
                                        onChange={(e) => setActualOutput(Number(e.target.value))}
                                    />
                                    <button
                                        onClick={() => setActualOutput(prev => prev + 1)}
                                        className="w-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border-l border-gray-200 text-slate-400 hover:text-primary transition-colors flex items-center justify-center"
                                    >
                                        <span className="material-symbols-outlined text-[22px]">add</span>
                                    </button>
                                </div>
                            </div>

                            {/* Tool Changes & Rejects */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wide ml-0.5">Tool Changes</label>
                                    <div className="flex items-stretch h-12 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                                        <button
                                            onClick={() => setToolChanges(prev => Math.max(0, prev - 1))}
                                            className="w-12 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border-r border-gray-200 text-slate-400 hover:text-primary transition-colors flex items-center justify-center"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">remove</span>
                                        </button>
                                        <input
                                            className="flex-1 min-w-0 bg-transparent text-center text-lg font-bold text-slate-800 border-none focus:ring-0 p-0"
                                            type="number"
                                            value={toolChanges}
                                            onChange={(e) => setToolChanges(Number(e.target.value))}
                                        />
                                        <button
                                            onClick={() => setToolChanges(prev => prev + 1)}
                                            className="w-12 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border-l border-gray-200 text-slate-400 hover:text-primary transition-colors flex items-center justify-center"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">add</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wide ml-0.5">Rejects</label>
                                    <div className="flex items-stretch h-12 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                                        <button
                                            onClick={() => setRejects(prev => Math.max(0, prev - 1))}
                                            className="w-12 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border-r border-gray-200 text-slate-400 hover:text-primary transition-colors flex items-center justify-center"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">remove</span>
                                        </button>
                                        <input
                                            className="flex-1 min-w-0 bg-transparent text-center text-lg font-bold text-red-600 border-none focus:ring-0 p-0"
                                            type="number"
                                            value={rejects}
                                            onChange={(e) => setRejects(Number(e.target.value))}
                                        />
                                        <button
                                            onClick={() => setRejects(prev => prev + 1)}
                                            className="w-12 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border-l border-gray-200 text-slate-400 hover:text-primary transition-colors flex items-center justify-center"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">add</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2">
                                <label className="block text-xs font-semibold text-slate-800 uppercase tracking-wide ml-0.5">Remarks <span className="text-[10px] font-normal text-slate-400 normal-case">(optional)</span></label>
                                <textarea
                                    className="w-full bg-white rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary text-slate-800 p-3 text-sm min-h-[80px] resize-none placeholder-gray-400 shadow-sm"
                                    placeholder="Enter notes..."
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                ></textarea>
                            </div>

                            {/* Save Button */}
                            <div className="pt-4 pb-2">
                                <button
                                    onClick={handleSave}
                                    className="w-full bg-primary hover:bg-[#23465b] text-white font-medium text-base h-12 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
                                >
                                    <span className="material-symbols-outlined text-[20px]">save</span>
                                    Save & Submit Entry
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
