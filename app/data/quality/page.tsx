"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

export default function QualityPage() {
    const router = useRouter();

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard">
            <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <button
                    onClick={() => router.back()}
                    className="size-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 active:scale-95 transition-transform -ml-2"
                >
                    <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold font-display text-primary">Quality Assessment</h1>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="size-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-[36px] text-emerald-400">verified_user</span>
                </div>
                <h2 className="text-lg font-bold text-gray-800 mb-2">Quality Control</h2>
                <p className="text-sm text-gray-500 max-w-[240px]">Live alerts, defect rates, and service report logs will appear here.</p>
            </main>
        </div>
    );
}
