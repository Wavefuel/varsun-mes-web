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
                        className="flex items-center gap-1.5 bg-white border border-card-border card-shadow rounded-lg py-1.5 px-3 transition-all active:scale-95 text-primary hover:border-primary/30"
                    >
                        <span className="material-symbols-outlined !text-sm text-primary">calendar_today</span>
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            {getDisplayDate(currentDate)}
                        </span>
                    </button>
                }
            />

            {/* Right: Navigation Arrows */}
            <div className="flex items-center gap-1.5">
                <button
                    onClick={handlePrevDate}
                    disabled={disabled}
                    className="size-7 flex items-center justify-center rounded-lg bg-white border border-card-border shadow-sm text-primary hover:text-primary hover:border-primary/50 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                    <span className="material-symbols-outlined !text-lg">chevron_left</span>
                </button>
                <button
                    onClick={handleNextDate}
                    disabled={disabled}
                    className="size-7 flex items-center justify-center rounded-lg bg-white border border-card-border shadow-sm text-primary hover:text-primary hover:border-primary/50 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                    <span className="material-symbols-outlined !text-lg">chevron_right</span>
                </button>
            </div>
        </div>
    );
}
