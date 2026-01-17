"use client";

import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface SearchFilterBarProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    placeholder?: string;
    showFilters: boolean;
    onToggleFilters: () => void;
    className?: string;
}

export default function SearchFilterBar({
    searchQuery,
    onSearchChange,
    placeholder = "Search...",
    showFilters,
    onToggleFilters,
    className
}: SearchFilterBarProps) {
    return (
        <div className={cn("flex gap-2.5", className)}>
            <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 !text-[18px]">search</span>
                <input
                    type="text"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary/50 transition-all shadow-sm"
                />
            </div>
            <button
                onClick={onToggleFilters}
                className={cn(
                    "size-9 flex items-center justify-center rounded-xl border shadow-sm transition-colors shrink-0",
                    showFilters ? "bg-primary border-primary text-white" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                )}
            >
                <span className="material-symbols-outlined !text-[18px]">filter_list</span>
            </button>
        </div>
    );
}
