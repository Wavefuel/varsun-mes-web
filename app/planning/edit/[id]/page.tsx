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
            // We don't change status here usually unless we explicitly add a dropdown for it
        });

        toast.success("Assignment updated");
        router.back();
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard">

            {/* Header - Styled to match AppHeader */}
            <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="size-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 active:scale-95 transition-transform -ml-2"
                    >
                        <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                    </button>
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none mb-0.5">Planning</span>
                        <h1 className="text-lg font-bold font-display text-primary leading-none">Edit Assignment</h1>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="bg-primary hover:bg-[#23485d] text-white text-[12px] font-bold px-4 py-2 rounded-lg shadow-sm active:scale-[0.98] transition-all"
                >
                    SAVE
                </button>
            </header>

            <main className="p-5 pb-32 space-y-6 max-w-[480px] mx-auto">

                {/* Section: Resources */}
                <section className="space-y-3">
                    <h2 className="text-xs font-bold text-primary uppercase tracking-widest ml-1">Resources</h2>
                    <div className="space-y-4">
                        {/* Machine */}
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Machine</label>
                            <div className="relative">
                                <select
                                    value={machine}
                                    onChange={(e) => setMachine(e.target.value)}
                                    className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-sm"
                                >
                                    <option>CNC-042 (Alpha)</option>
                                    <option>CNC-01</option>
                                    <option>CNC-03 (Beta)</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[22px]">expand_more</span>
                            </div>
                        </div>

                        {/* Operator */}
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Operator</label>
                            <div className="relative">
                                <select
                                    value={operator}
                                    onChange={(e) => setOperator(e.target.value)}
                                    className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-sm"
                                >
                                    <option>Marcus Jensen</option>
                                    <option>Sarah Chen</option>
                                    <option>Alex R.</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[22px]">expand_more</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Schedule */}
                <section className="space-y-3">
                    <h2 className="text-xs font-bold text-primary uppercase tracking-widest ml-1">Schedule</h2>

                    {/* Date & Shift Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Date</label>
                            <div className="relative">
                                <CustomDatePicker
                                    value={date}
                                    onChange={setDate}
                                    customInput={
                                        <button className="w-full flex items-center justify-between bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-800 transition-all shadow-sm uppercase text-left hover:border-primary/50 focus:border-primary">
                                            <span>{date ? new Date(date).toLocaleDateString('en-CA') : 'Select Date'}</span>
                                            <span className="material-symbols-outlined text-gray-400 text-[20px]">calendar_today</span>
                                        </button>
                                    }
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Shift</label>
                            <div className="relative">
                                <select
                                    value={shift}
                                    onChange={(e) => setShift(e.target.value)}
                                    className="w-full appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-sm"
                                >
                                    <option>Day (S1)</option>
                                    <option>Night (S2)</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[22px]">expand_more</span>
                            </div>
                        </div>
                    </div>

                    {/* Times Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Start</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-2 py-3 text-sm font-bold text-gray-800 text-center focus:outline-none focus:border-primary shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">End</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-2 py-3 text-sm font-bold text-gray-800 text-center focus:outline-none focus:border-primary shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Code</label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-2 py-3 text-sm font-bold text-gray-800 text-center focus:outline-none focus:border-primary shadow-sm"
                            />
                        </div>
                    </div>
                </section>

                {/* Section: Production */}
                <section className="space-y-3">
                    <h2 className="text-xs font-bold text-primary uppercase tracking-widest ml-1">Production</h2>
                    <div className="space-y-4">

                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Part Number</label>
                            <input
                                type="text"
                                value={partNumber}
                                onChange={(e) => {
                                    setPartNumber(e.target.value);
                                    if (errors.partNumber) setErrors(prev => ({ ...prev, partNumber: false }));
                                }}
                                className={`w-full bg-white border rounded-xl px-4 py-3.5 text-base font-bold text-gray-800 focus:outline-none focus:ring-1 transition-all shadow-sm ${errors.partNumber
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                                    : 'border-gray-300 focus:border-primary focus:ring-primary/20'
                                    }`}
                                placeholder="Enter Part #"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Work Order</label>
                            <input
                                type="text"
                                value={workOrderId}
                                disabled // Work Order ID shouldn't be changeable usually as it's the key
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base font-bold text-gray-500 focus:outline-none"
                            />
                        </div>

                        {/* Quantitative Data */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Op #</label>
                                <input
                                    type="number"
                                    value={opNumber}
                                    onChange={(e) => setOpNumber(Number(e.target.value))}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-3 text-sm font-bold text-gray-800 text-center focus:outline-none focus:border-primary shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Batch</label>
                                <input
                                    type="number"
                                    value={batch}
                                    onChange={(e) => setBatch(Number(e.target.value))}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-3 text-sm font-bold text-gray-800 text-center focus:outline-none focus:border-primary shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5">Est/Part</label>
                                <input
                                    type="text"
                                    value={estPart}
                                    onChange={(e) => setEstPart(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-2 py-3 text-sm font-bold text-gray-800 text-center focus:outline-none focus:border-primary shadow-sm"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <button
                    onClick={() => {
                        if (confirm('Are you sure you want to delete this assignment?')) {
                            deleteOrder(orderId);
                            toast.success('Assignment deleted');
                            router.push('/planning');
                        }
                    }}
                    className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl hover:bg-red-100 transition-colors"
                >
                    Delete Assignment
                </button>
            </main>
        </div>
    );
}
