import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'primary' | 'success' | 'warning' | 'neutral';
}

export function Badge({ children, className, variant = 'primary', ...props }: BadgeProps) {
    const variants = {
        primary: "text-primary bg-primary/5",
        success: "text-green-600 bg-green-50",
        warning: "text-orange-500 bg-orange-50", // Adjusted from reference context
        neutral: "text-gray-500 bg-gray-100",
    };

    return (
        <span className={cn("text-2xs font-bold px-2 py-0.5 rounded uppercase", variants[variant], className)} {...props}>
            {children}
        </span>
    );
}
