'use client';

import React from 'react';
import CustomDatePicker from './CustomDatePicker';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface DateNavigatorProps {
    currentDate: string;
    setCurrentDate: (date: string) => void;
    disabled?: boolean;
    className?: string;
}

export default function DateNavigator({ currentDate, setCurrentDate, disabled, className }: DateNavigatorProps) {

    const getDisplayDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }).toUpperCase();
    };

    const handlePrevDate = () => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - 1);
        setCurrentDate(date.toISOString().split('T')[0]);
    };

    const handleNextDate = () => {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + 1);
        setCurrentDate(date.toISOString().split('T')[0]);
    };

    return (
        <div className={cn("flex items-center justify-between py-1 px-1", className)}>
            {/* Left: Date Picker */}
            <CustomDatePicker
                value={currentDate}
                onChange={setCurrentDate}
                disabled={disabled}
                customInput={
                    <button
                        disabled={disabled}
                        className="flex items-center gap-2 text-primary hover:bg-primary/5 rounded-lg py-1 px-2 transition-colors -ml-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        <span className="text-sm font-bold font-display uppercase tracking-wider">
                            {getDisplayDate(currentDate)}
                        </span>
                    </button>
                }
            />

            {/* Right: Navigation Arrows */}
            <div className="flex items-center gap-2">
                <button
                    onClick={handlePrevDate}
                    disabled={disabled}
                    className="size-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 shadow-sm text-primary hover:text-primary hover:border-primary/50 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button
                    onClick={handleNextDate}
                    disabled={disabled}
                    className="size-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 shadow-sm text-primary hover:text-primary hover:border-primary/50 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
            </div>
        </div>
    );
}
