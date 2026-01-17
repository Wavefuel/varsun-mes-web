"use client";

import React from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

export default function DataDashboard() {
    const categories = [
        {
            title: "Utilization Report",
            description: "Basic OEE metrics & Efficiency",
            icon: "speed",
            color: "text-blue-500",
            bg: "bg-blue-50",
            href: "/data/utilization"
        },
        {
            title: "Quality Assessment",
            description: "Alerts & Service Reports",
            icon: "verified_user",
            color: "text-emerald-500",
            bg: "bg-emerald-50",
            href: "/data/quality"
        },
        {
            title: "Downtime Events", // Renamed to match the inner page title in screenshot
            description: "Uptime/Downtime Analysis",
            icon: "error", // Or 'history_toggle_off'
            color: "text-amber-500",
            bg: "bg-amber-50",
            href: "/data/downtime"
        }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard">
            <AppHeader title="Data & Analytics" />

            <main className="p-5 space-y-4">
                {/* Intro Card */}
                <div className="bg-primary rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold font-display mb-1">Production Insights</h2>
                        <p className="text-xs text-blue-100 opacity-80 leading-relaxed max-w-[80%]">
                            Review plant performance, track downtime, and analyze quality metrics.
                        </p>
                    </div>
                    {/* Decorative Blob */}
                    <div className="absolute -right-4 -bottom-4 size-24 bg-white/10 rounded-full blur-2xl"></div>
                </div>

                {/* Categories Grid */}
                <div className="grid gap-3">
                    {categories.map((cat) => (
                        <Link
                            key={cat.title}
                            href={cat.href}
                            className="bg-white p-4 rounded-xl border border-card-border shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center gap-4 active:scale-[0.99] transition-all hover:bg-gray-50"
                        >
                            <div className={`size-12 rounded-xl flex items-center justify-center ${cat.bg} ${cat.color} shrink-0`}>
                                <span className="material-symbols-outlined text-[24px]">{cat.icon}</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold font-display text-gray-900">{cat.title}</h3>
                                <p className="text-[11px] font-medium text-gray-400 mt-0.5">{cat.description}</p>
                            </div>
                            <span className="material-symbols-outlined text-gray-300 text-[20px]">chevron_right</span>
                        </Link>
                    ))}
                </div>

                {/* Recent Alerts (Placeholder for "Data Analysis" vibe) */}
                <div className="pt-2">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Recent Alerts</h3>
                    <div className="space-y-2">
                        <div className="bg-white px-3 py-2.5 rounded-lg border border-gray-100 flex items-start gap-3">
                            <div className="size-1.5 rounded-full bg-red-500 mt-1.5 shrink-0"></div>
                            <div>
                                <p className="text-xs font-bold text-gray-800">Spindle temperature high</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">CNC-01 • 10:42 AM</p>
                            </div>
                        </div>
                        <div className="bg-white px-3 py-2.5 rounded-lg border border-gray-100 flex items-start gap-3">
                            <div className="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
                            <div>
                                <p className="text-xs font-bold text-gray-800">Material shortage detected</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Line A • 09:15 AM</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
