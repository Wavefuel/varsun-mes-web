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
        <div className={cn("flex gap-2", className)}>
            <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 !text-sm">search</span>
                <input
                    type="text"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-9 pr-4 h-8 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary/50 transition-all shadow-sm"
                />
            </div>
            <button
                onClick={onToggleFilters}
                className={cn(
                    "size-8 flex items-center justify-center rounded-lg border card-shadow transition-colors shrink-0",
                    showFilters ? "bg-primary border-primary text-white" : "bg-white border-card-border text-gray-500 hover:bg-gray-50"
                )}
            >
                <span className="material-symbols-outlined !text-sm">filter_list</span>
            </button>
        </div>
    );
}
