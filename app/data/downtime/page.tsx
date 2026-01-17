"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DowntimeEventsPage() {
    const router = useRouter();
    const [tagMode, setTagMode] = useState(false); // Toggle switch state

    // Mock detected events
    const [events, setEvents] = useState([
        {
            id: 1,
            machine: "CNC-01",
            startTime: "10:30",
            endTime: "10:45",
            duration: "15m",
            type: "untagged", // alert
            status: "UNTAGGED",
            remarks: "",
            reason: ""
        },
        {
            id: 2,
            machine: "LATHE-05",
            startTime: "08:00",
            endTime: "08:20",
            duration: "20m",
            type: "offline", // silent
            status: "OFFLINE",
            remarks: "",
            reason: ""
        }
    ]);

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
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none mb-0.5">Execution &rsaquo; Tagging</span>
                        <h1 className="text-lg font-bold font-display text-primary leading-none">Downtime Events</h1>
                    </div>
                </div>
                {/* Visual Toggle Switch */}
                <div
                    onClick={() => setTagMode(!tagMode)}
                    className={`w-12 h-7 rounded-full flex items-center p-1 cursor-pointer transition-colors ${tagMode ? 'bg-primary' : 'bg-gray-200'}`}
                >
                    <div className={`size-5 bg-white rounded-full shadow-sm transition-transform ${tagMode ? 'translate-x-[20px]' : 'translate-x-0'}`}></div>
                </div>
            </header>

            <main className="p-4 pb-32 space-y-6 max-w-[480px] mx-auto">

                {/* Metrics Cards */}
                <div className="grid grid-cols-3 gap-2">
                    {/* Untagged Card */}
                    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="material-symbols-outlined text-amber-500 text-[20px] mb-1">priority_high</span>
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Untagged</div>
                        <div className="text-sm font-bold text-gray-800">45 <span className="text-[10px] text-gray-500 font-medium">min</span></div>
                    </div>

                    {/* Total Idle Card */}
                    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="material-symbols-outlined text-blue-500 text-[20px] mb-1">hourglass_empty</span>
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Idle</div>
                        <div className="text-sm font-bold text-gray-800">2h 10m</div>
                    </div>

                    {/* Total Offline Card */}
                    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="material-symbols-outlined text-slate-500 text-[20px] mb-1">power_off</span>
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Offline</div>
                        <div className="text-sm font-bold text-gray-800">15 <span className="text-[10px] text-gray-500 font-medium">min</span></div>
                    </div>
                </div>

                {/* Detected Events List */}
                <section>
                    <div className="flex justify-between items-center mb-3 px-1">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Detected Events</h2>
                        <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-md">Shift 1 (08:00 - 16:00)</span>
                    </div>

                    <div className="space-y-4">
                        {events.map((event) => (
                            <div key={event.id} className={`bg-white rounded-xl border p-4 shadow-sm ${event.type === 'untagged' ? 'border-amber-200' : 'border-red-100'}`}>

                                {/* Event Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`size-10 rounded-lg flex items-center justify-center ${event.type === 'untagged' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-500'}`}>
                                            <span className="material-symbols-outlined text-[20px]">
                                                {event.type === 'untagged' ? 'priority_high' : 'power_off'}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold font-display text-gray-900">{event.machine}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                    {event.startTime} - {event.endTime}
                                                </span>
                                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-600">{event.duration}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${event.status === 'UNTAGGED'
                                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                            : 'bg-red-100 text-red-600 border border-red-200'
                                        }`}>
                                        {event.status}
                                    </span>
                                </div>

                                {/* Divider */}
                                <div className={`h-px w-full mb-4 ${event.type === 'untagged' ? 'bg-amber-50' : 'bg-red-50'}`}></div>

                                {/* Inputs */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block ml-1">Reason Code</label>
                                        <div className="relative">
                                            <select className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-bold text-gray-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20">
                                                <option>Select a reason...</option>
                                                <option>Waiting for material</option>
                                                <option>Tool breakage</option>
                                                <option>Maintenance</option>
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[20px]">expand_more</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block ml-1">Remarks <span className="font-medium normal-case opacity-70">(Optional)</span></label>
                                        <input
                                            type="text"
                                            placeholder={event.type === 'untagged' ? "e.g. Waiting for material..." : "Enter details..."}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {/* Bottom Floating Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-40 max-w-[480px] mx-auto shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <button className="w-full bg-primary hover:bg-[#23485d] text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-all">
                    <span className="material-symbols-outlined">edit_note</span>
                    <span>Submit Tags ({events.length})</span>
                </button>
            </div>
        </div>
    );
}
