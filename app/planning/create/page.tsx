"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { CustomToast } from '@/components/CustomToast';
import CustomDatePicker from '@/components/CustomDatePicker';

export default function CreateAssignmentPage() {
    const router = useRouter();
    const { addOrder, currentDate, setCurrentDate, orders } = useData();

    // Form inputs state
    // Initialize date with the currently selected global date, but allow user to change it
    const [machine, setMachine] = useState("CNC-042 (Alpha)");
    const [operator, setOperator] = useState("Marcus Jensen");
    const [date, setDate] = useState(currentDate);
    const [shift, setShift] = useState("Day (S1)");
    const [startTime, setStartTime] = useState("06:00");
    const [endTime, setEndTime] = useState("14:00");
    const [code, setCode] = useState("SH-D24");
    const [partNumber, setPartNumber] = useState("");
    const [workOrderId, setWorkOrderId] = useState("");
    const [opNumber, setOpNumber] = useState(20);
    const [batch, setBatch] = useState(450);
    const [estTime, setEstTime] = useState("1.5");
    const [estUnit, setEstUnit] = useState("min"); // 'min' or 'hr'
    const [errors, setErrors] = useState<Record<string, boolean>>({});

    const handleSave = () => {
        const newErrors: Record<string, boolean> = {};
        if (!partNumber) newErrors.partNumber = true;
        if (!workOrderId) newErrors.workOrderId = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.custom((t) => (
                <CustomToast
                    t={t}
                    title="Validation Error"
                    message="Please complete all required fields to proceed."
                />
            ));
            return;
        }

        // Capacity Validation
        const getMinutesFromTime = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const startMin = getMinutesFromTime(startTime);
        let endMin = getMinutesFromTime(endTime);
        // Handle overnight shift (e.g., 22:00 to 06:00)
        if (endMin < startMin) {
            endMin += 24 * 60;
        }

        const shiftDurationMinutes = endMin - startMin;

        let estPerPartMinutes = parseFloat(estTime);
        if (estUnit === 'hr') {
            estPerPartMinutes *= 60;
        }

        const totalRequiredMinutes = batch * estPerPartMinutes;

        if (totalRequiredMinutes > shiftDurationMinutes) {
            const reqHrs = Math.floor(totalRequiredMinutes / 60);
            const reqMins = Math.round(totalRequiredMinutes % 60);

            const shiftHrs = Math.floor(shiftDurationMinutes / 60);
            const shiftMins = Math.round(shiftDurationMinutes % 60);

            setErrors(prev => ({ ...prev, capacity: true, shift: true }));

            toast.custom((t) => (
                <CustomToast
                    t={t}
                    title="Capacity Limit Exceeded"
                    message={
                        <span>
                            Required time <span className="font-bold">{reqHrs}h {reqMins}m</span> exceeds shift duration <span className="font-bold">{shiftHrs}h {shiftMins}m</span>.
                        </span>
                    }
                    actions="Try reducing Batch Qty/Est. Part or extending Shift."
                />
            ), { duration: 10000 });
            return;
        }

        // Clear capacity error if validation passes
        if (errors.capacity || errors.shift) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.capacity;
                delete newErrors.shift;
                return newErrors;
            });
        }

        addOrder({
            id: workOrderId,
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
            estPart: `${estTime}${estUnit === 'min' ? 'm' : 'h'}`,
            target: batch,
            status: 'PLANNED'
        });

        // Update the global date to match the new assignment so the user sees it immediately
        if (date !== currentDate) {
            setCurrentDate(date);
        }

        router.push('/planning');
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard">

            {/* Top Navigation Bar - Matching reference header exactly */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="flex items-center p-4 justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => router.back()} className="flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-2xl">arrow_back</span>
                        </button>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold leading-none mb-0.5">Planning</p>
                            <h2 className="text-lg font-bold leading-tight tracking-tight text-[#131516]">Shift Assignment</h2>
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


                {/* Section: New Assignment Form */}
                <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-primary">New Assignment</h3>
                        <span className="material-symbols-outlined text-gray-400">precision_manufacturing</span>
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
                        <div className={`flex gap-2 bg-primary/5 p-3 rounded-lg border transition-colors ${errors.shift ? 'border-red-500 bg-red-50' : 'border-primary/10'}`}>
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
                                    onChange={(e) => {
                                        setStartTime(e.target.value);
                                        if (errors.shift) setErrors(prev => { const n = { ...prev }; delete n.shift; delete n.capacity; return n; });
                                    }}
                                    className="w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0"
                                />
                            </div>
                            <div className="w-px bg-primary/20"></div>
                            <div className="flex-1">
                                <p className="text-[9px] font-bold text-primary/60 uppercase">End</p>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => {
                                        setEndTime(e.target.value);
                                        if (errors.shift) setErrors(prev => { const n = { ...prev }; delete n.shift; delete n.capacity; return n; });
                                    }}
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
                                        onChange={(e) => {
                                            setWorkOrderId(e.target.value);
                                            if (errors.workOrderId) setErrors(prev => ({ ...prev, workOrderId: false }));
                                        }}
                                        className={`w-full bg-gray-50 border rounded-lg py-3 px-3 text-sm font-mono text-gray-800 focus:ring-primary focus:border-primary ${errors.workOrderId ? 'border-red-500' : 'border-gray-200'}`}
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
                                        onChange={(e) => {
                                            setBatch(Number(e.target.value));
                                            if (errors.capacity) setErrors(prev => { const n = { ...prev }; delete n.capacity; return n; });
                                        }}
                                        className={`w-full bg-gray-50 border rounded-lg py-2.5 px-3 text-xs focus:ring-primary focus:border-primary font-sans transition-colors ${errors.capacity ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 font-sans">Est/Part ({estUnit})</label>
                                    <div className={`flex bg-gray-50 border rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-colors ${errors.capacity ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                        <input
                                            type="text"
                                            value={estTime}
                                            onChange={(e) => {
                                                setEstTime(e.target.value);
                                                if (errors.capacity) setErrors(prev => { const n = { ...prev }; delete n.capacity; return n; });
                                            }}
                                            className="w-full bg-transparent border-none py-2.5 px-3 text-xs text-center focus:ring-0 font-sans"
                                            placeholder="1.5"
                                        />
                                        <div className="w-px bg-gray-200"></div>
                                        <div className="relative w-24 bg-gray-100">
                                            <select
                                                value={estUnit}
                                                onChange={(e) => setEstUnit(e.target.value)}
                                                className="w-full h-full bg-transparent border-none py-0 pl-3 pr-8 text-xs text-gray-700 font-bold focus:ring-0 appearance-none font-sans"
                                            >
                                                <option value="min">min</option>
                                                <option value="hr">hr</option>
                                            </select>
                                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-[16px]">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section: Queue / Planned Assignments (Dynamic) */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-600">Planned Queue <span className="text-gray-400 normal-case tracking-normal">({machine.split(' ')[0]})</span></h3>
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {orders.filter(o => o.machine === machine && o.date === date).length} Tasks
                        </span>
                    </div>
                    {/* Filtered Queue List */}
                    <div className="space-y-2">
                        {orders.filter(o => o.machine === machine && o.date === date)
                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                            .map((order) => (
                                <div key={order.id} className="bg-white border border-gray-100 p-3 rounded-lg flex items-center gap-3">
                                    <div className="size-10 bg-gray-100 rounded flex items-center justify-center shrink-0 text-gray-400">
                                        <span className="material-symbols-outlined text-xl">
                                            {order.status === 'ACTIVE' ? 'play_circle' :
                                                order.status === 'COMPLETED' ? 'check_circle' : 'schedule'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-sm truncate text-gray-800">{order.id} • {order.partNumber}</p>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${order.status === 'ACTIVE' ? 'text-green-600 bg-green-50' :
                                                order.status === 'COMPLETED' ? 'text-blue-600 bg-blue-50' :
                                                    'text-gray-400 bg-gray-50'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 font-medium font-sans">
                                            Op {order.opNumber} • {order.operator.split(' ')[0]} • {order.shift}
                                        </p>
                                    </div>
                                </div>
                            ))}

                        {orders.filter(o => o.machine === machine && o.date === date).length === 0 && (
                            <div className="text-center py-6 text-gray-400 text-xs italic bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                No planned tasks for {machine.split(' ')[0]} on this date.
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
