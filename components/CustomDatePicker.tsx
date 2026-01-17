"use client";

import React, { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './CustomDatePicker.css';
import { format, parseISO } from 'date-fns';


// Since I saw `cn` function defined inside file in previous `view_file` calls, 
// I should probably check if there is a shared utils file. 
// The user had: function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); } locally.
// I'll define a local helper or look for it. Use clsx/tailwind-merge.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface CustomDatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    className?: string; // Class for the wrapper
    wrapperClassName?: string;
    customInput?: React.ReactNode;
    disabled?: boolean;
}

// Custom Input Component compatible with React Datepicker
const CustomInput = forwardRef<HTMLButtonElement, any>(({ value, onClick, className, children }, ref) => (
    <button
        ref={ref}
        onClick={onClick}
        className={className}
        type="button"
    >
        {children || value}
    </button>
));
CustomInput.displayName = "CustomInput";

export default function CustomDatePicker({ value, onChange, className, customInput, disabled }: CustomDatePickerProps) {
    // Parse string YYYY-MM-DD to Date object
    const selectedDate = value ? parseISO(value) : undefined;

    const handleChange = (date: Date | null) => {
        if (date) {
            // Format back to YYYY-MM-DD
            onChange(format(date, 'yyyy-MM-dd'));
        }
    };

    return (
        <div className="custom-datepicker-wrapper">

            <DatePicker
                selected={selectedDate}
                onChange={handleChange}
                disabled={disabled}
                customInput={
                    customInput ? React.cloneElement(customInput as React.ReactElement, {
                        // React Datepicker injects onClick, value, ref
                    }) : undefined
                }
                dateFormat="yyyy-MM-dd"
                popperPlacement="bottom-start"
                showPopperArrow={false}
                calendarClassName="font-sans shadow-xl border-0"
            />
        </div>
    );
}
