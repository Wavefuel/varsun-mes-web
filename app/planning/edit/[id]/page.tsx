"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import CustomDatePicker from '@/components/CustomDatePicker';

export default function EditAssignmentPage() {
    const router = useRouter();
    const params = useParams();
    const { getOrderById, updateOrder, deleteOrder } = useData();

    const rawId = params?.id;
    const idString = Array.isArray(rawId) ? rawId[0] : rawId;
    const orderId = idString ? decodeURIComponent(idString) : "";

    // Form inputs state
    const [machine, setMachine] = useState("CNC-042 (Alpha)");
    const [operator, setOperator] = useState("Marcus Jensen");
    const [date, setDate] = useState("");
    const [shift, setShift] = useState("Day (S1)");
    const [startTime, setStartTime] = useState("06:00");
    const [endTime, setEndTime] = useState("14:00");
    const [code, setCode] = useState("SH-D24");
    const [partNumber, setPartNumber] = useState("");
    const [workOrderId, setWorkOrderId] = useState("");
    const [opNumber, setOpNumber] = useState(20);
    const [batch, setBatch] = useState(450);
    const [estPart, setEstPart] = useState("1.5m");
    const [errors, setErrors] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (orderId) {
            const order = getOrderById(orderId);
            if (order) {
                setMachine(order.machine);
                setOperator(order.operator);
                setDate(order.date);
                setShift(order.shift);
                setStartTime(order.startTime);
                setEndTime(order.endTime);
                setCode(order.code || "SH-D24");
                setPartNumber(order.partNumber);
                setWorkOrderId(order.id);
                setOpNumber(order.opNumber || 20);
                setBatch(order.batch || 450);
                setEstPart(order.estPart || "1.5m");
            } else {
                toast.error("Order not found");
                router.push('/planning');
            }
        }
    }, [orderId, getOrderById, router]);

    const handleSave = () => {
        const newErrors: Record<string, boolean> = {};
        if (!partNumber) newErrors.partNumber = true;
        if (!workOrderId) newErrors.workOrderId = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error("Please complete all required fields");
            return;
        }

        updateOrder(orderId, {
            partNumber: partNumber,
            machine: machine,
            operator: operator,
            date: date,
            shift: shift,
            startTime: startTime,
            endTime: endTime,
            code: code,
            opNumber: opNumber,
            batch: batch,
            estPart: estPart,
            target: batch,
        });

        toast.success("Assignment updated");
        router.back();
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard">

            {/* Top Navigation Bar - Matching create page header exactly */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="flex items-center p-4 justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.back()} className="flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-2xl">arrow_back</span>
                        </button>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold leading-none mb-0.5">Planning</p>
                            <h2 className="text-lg font-bold leading-tight tracking-tight text-[#131516]">Edit Assignment</h2>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        className="bg-primary text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm active:scale-95 transition-transform"
                    >
                        SAVE
                    </button>
                </div>
            </header>

            <main className="p-4 space-y-6 pb-24">

                {/* Section: Edit Assignment Form */}
                <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-primary">Assignment Details</h3>
                        <span className="material-symbols-outlined text-gray-400">edit_note</span>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Dropdowns Pair (Machine & Operator) */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 font-sans">Machine</label>
                                <div className="relative">
                                    <select
                                        value={machine}
                                        onChange={(e) => setMachine(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-xs text-gray-800 appearance-none focus:ring-primary focus:border-primary font-sans"
                                    >
                                        <option>CNC-042 (Alpha)</option>
                                        <option>LATH-09 (Beta)</option>
                                        <option>MILL-12 (Gamma)</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[18px]">expand_more</span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 font-sans">Operator</label>
                                <div className="relative">
                                    <select
                                        value={operator}
                                        onChange={(e) => setOperator(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-xs text-gray-800 appearance-none focus:ring-primary focus:border-primary font-sans"
                                    >
                                        <option>Marcus Jensen</option>
                                        <option>Sarah Chen</option>
                                        <option>David Miller</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[18px]">expand_more</span>
                                </div>
                            </div>
                        </div>

                        {/* Date and Shift Selection */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 font-sans">Shift Date</label>
                                <div className="relative">
                                    <CustomDatePicker
                                        value={date}
                                        onChange={setDate}
                                        customInput={
                                            <button className="w-full flex items-center bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-left transition-all font-sans">
                                                <span className="text-xs font-medium text-gray-800">{date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select Date'}</span>
                                                <span className="material-symbols-outlined ml-auto text-gray-400 text-[18px]">calendar_today</span>
                                            </button>
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 font-sans">Shift Work</label>
                                <div className="relative">
                                    <select
                                        value={shift}
                                        onChange={(e) => setShift(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-xs text-gray-800 appearance-none focus:ring-primary focus:border-primary font-sans"
                                    >
                                        <option>Day Shift (S1)</option>
                                        <option>Night Shift (S2)</option>
                                        <option>Custom</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[18px]">expand_more</span>
                                </div>
                            </div>
                        </div>

                        {/* Visual Logic Badges (Code/Start/End) */}
                        <div className="flex gap-2 bg-primary/5 p-3 rounded-lg border border-primary/10 transition-colors">
                            <div className="flex-1">
                                <p className="text-[9px] font-bold text-primary/60 uppercase">Code</p>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 placeholder-primary/50"
                                />
                            </div>
                            <div className="w-px bg-primary/20"></div>
                            <div className="flex-1">
                                <p className="text-[9px] font-bold text-primary/60 uppercase">Start</p>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0"
                                />
                            </div>
                            <div className="w-px bg-primary/20"></div>
                            <div className="flex-1">
                                <p className="text-[9px] font-bold text-primary/60 uppercase">End</p>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0"
                                />
                            </div>
                        </div>

                        {/* Production Details */}
                        <div className="space-y-3 pt-2">
                            {/* Part # & WO # */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Part Number</label>
                                    <input
                                        type="text"
                                        value={partNumber}
                                        onChange={(e) => {
                                            setPartNumber(e.target.value);
                                            if (errors.partNumber) setErrors(prev => ({ ...prev, partNumber: false }));
                                        }}
                                        className={`w-full bg-gray-50 border rounded-lg py-3 px-3 text-sm font-mono text-gray-800 focus:ring-primary focus:border-primary ${errors.partNumber ? 'border-red-500' : 'border-gray-200'}`}
                                        placeholder="P-90882-X"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Work Order</label>
                                    <input
                                        type="text"
                                        value={workOrderId}
                                        disabled
                                        className="w-full bg-gray-100 border border-gray-200 rounded-lg py-3 px-3 text-sm font-mono text-gray-500 focus:outline-none cursor-not-allowed"
                                        placeholder="WO-55612"
                                    />
                                </div>
                            </div>

                            {/* Op / Batch / Est */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Op #</label>
                                    <input
                                        type="number"
                                        value={opNumber}
                                        onChange={(e) => setOpNumber(Number(e.target.value))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-3 px-3 text-sm focus:ring-primary focus:border-primary"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 font-sans">Batch Qty</label>
                                    <input
                                        type="number"
                                        value={batch}
                                        onChange={(e) => setBatch(Number(e.target.value))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-xs focus:ring-primary focus:border-primary font-sans"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 font-sans">Est/Part</label>
                                    <input
                                        type="text"
                                        value={estPart}
                                        onChange={(e) => setEstPart(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-xs text-center focus:ring-primary focus:border-primary font-sans"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </main>
        </div>
    );
}
