"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';

export default function WorkOrderCompletionPage() {
    const router = useRouter();
    const params = useParams();
    const { getOrderById, updateOrder, deleteOrder } = useData();

    const rawId = params?.id;
    const idString = Array.isArray(rawId) ? rawId[0] : rawId;
    const orderId = idString ? decodeURIComponent(idString) : "";

    const order = getOrderById(orderId);

    const [actualOutput, setActualOutput] = useState(0);
    const [toolChanges, setToolChanges] = useState(0);
    const [rejects, setRejects] = useState(0);
    const [remarks, setRemarks] = useState("");

    useEffect(() => {
        if (order) {
            setActualOutput(order.actualOutput || order.target || 0);
            setToolChanges(order.toolChanges || 0);
            setRejects(order.rejects || 0);
            setRemarks(order.remarks || "");
        }
    }, [order]);

    const handleSave = () => {
        if (orderId) {
            updateOrder(orderId, {
                status: 'COMPLETED',
                actualOutput,
                toolChanges,
                rejects,
                remarks
            });
            router.push('/stock');
        }
    };

    if (!order) {
        return (
            <div className="flex flex-col min-h-screen bg-background-dashboard items-center justify-center p-4 text-center">
                <button
                    onClick={() => router.back()}
                    className="absolute top-4 left-4 size-10 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-500"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="text-gray-400 font-bold mb-2">Order Not Found</div>
                <div className="text-xs text-gray-500">ID: {orderId}</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="size-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 active:scale-95 transition-transform -ml-2"
                    >
                        <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                    </button>
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none mb-0.5">Stock</span>
                        <h1 className="text-lg font-bold font-display text-primary leading-none">Complete Order</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push(`/planning/edit/${encodeURIComponent(orderId)}`)}
                        className="size-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 active:scale-95 transition-all"
                        title="Edit Details"
                    >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-primary hover:bg-[#23485d] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm active:scale-[0.98] transition-all"
                    >
                        SAVE
                    </button>
                </div>
            </header>

            <main className="p-5 pb-32 space-y-5 max-w-[480px] mx-auto">

                {/* --- COMPACT INPUTS --- */}
                <div className="space-y-4">
                    {/* Actual Output */}
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Actual Output (Good)</label>
                        <div className="bg-white rounded-lg border border-gray-200 flex items-center h-11 px-1 shadow-sm">
                            <button
                                onClick={() => setActualOutput(prev => Math.max(0, prev - 1))}
                                className="size-9 rounded-md bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined text-[18px]">remove</span>
                            </button>
                            <input
                                type="number"
                                value={actualOutput}
                                onChange={(e) => setActualOutput(Number(e.target.value))}
                                className="flex-1 bg-transparent border-none text-center text-lg font-bold text-gray-800 focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                                onClick={() => setActualOutput(prev => prev + 1)}
                                className="size-9 rounded-md bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                            </button>
                        </div>
                    </div>

                    {/* Secondary Inputs Row */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Tool Changes */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Tool Changes</label>
                            <div className="bg-white rounded-lg border border-gray-200 flex items-center h-11 px-1 shadow-sm">
                                <button
                                    onClick={() => setToolChanges(prev => Math.max(0, prev - 1))}
                                    className="size-9 rounded-md bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">remove</span>
                                </button>
                                <div className="flex-1 text-center text-sm font-bold text-gray-800">{toolChanges}</div>
                                <button
                                    onClick={() => setToolChanges(prev => prev + 1)}
                                    className="size-9 rounded-md bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                </button>
                            </div>
                        </div>

                        {/* Rejects */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Rejects</label>
                            <div className="bg-white rounded-lg border border-gray-200 flex items-center h-11 px-1 shadow-sm">
                                <button
                                    onClick={() => setRejects(prev => Math.max(0, prev - 1))}
                                    className="size-9 rounded-md bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">remove</span>
                                </button>
                                <div className="flex-1 text-center text-sm font-bold text-red-500">{rejects}</div>
                                <button
                                    onClick={() => setRejects(prev => prev + 1)}
                                    className="size-9 rounded-md bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Remarks</label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Add notes..."
                            className="w-full h-24 bg-white border border-gray-200 rounded-lg p-3 text-xs font-medium text-gray-700 placeholder:text-gray-300 focus:ring-1 focus:ring-primary focus:border-primary resize-none shadow-sm"
                        ></textarea>
                    </div>
                </div>

                {/* --- READ ONLY DETAILS CARD --- */}
                <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50/50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Order Details</h2>
                        <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-bold uppercase">Read Only</span>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Row 1: Key Identifiers */}
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            <div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Part Number</div>
                                <div className="text-xs font-bold text-gray-800">{order.partNumber}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Work Order</div>
                                <div className="text-xs font-bold text-gray-800">{order.id}</div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gray-100"></div>

                        {/* Row 2: Resources */}
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            <div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Machine</div>
                                <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px] text-primary">precision_manufacturing</span>
                                    {order.machine}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Operator</div>
                                <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px] text-primary">account_circle</span>
                                    {order.operator}
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gray-100"></div>

                        {/* Row 3: Schedule */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Shift</div>
                                <div className="text-xs font-bold text-gray-700">{order.shift}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Date</div>
                                <div className="text-xs font-bold text-gray-700">{order.date}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Time</div>
                                <div className="text-xs font-bold text-gray-700">{order.startTime} - {order.endTime}</div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gray-100"></div>

                        {/* Row 4: Metrics */}
                        <div className="flex justify-between items-center bg-gray-50 rounded-lg p-2.5">
                            <div className="text-center">
                                <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Batch</div>
                                <div className="text-xs font-bold text-gray-800">{order.batch}</div>
                            </div>
                            <div className="w-px h-5 bg-gray-200"></div>
                            <div className="text-center">
                                <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Est/Part</div>
                                <div className="text-xs font-bold text-gray-800">{order.estPart}</div>
                            </div>
                            <div className="w-px h-5 bg-gray-200"></div>
                            <div className="text-center">
                                <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Op #</div>
                                <div className="text-xs font-bold text-gray-800">{order.opNumber}</div>
                            </div>
                        </div>

                    </div>
                </div>

                <button
                    onClick={() => {
                        if (confirm('Are you sure you want to delete this order?')) {
                            deleteOrder(orderId);
                            toast.success('Order deleted');
                            router.push('/stock');
                        }
                    }}
                    className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl hover:bg-red-100 transition-colors mt-6"
                >
                    Delete Order
                </button>
            </main >
        </div >
    );
}
