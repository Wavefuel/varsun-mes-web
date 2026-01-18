import React from 'react';
import { cn } from '@/lib/utils';

export function MetricValue({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={cn("text-metric font-bold font-display text-primary leading-none", className)} {...props}>{children}</p>;
}

export function MetricLabel({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={cn("text-2xs font-bold text-gray-500 uppercase mt-1 leading-tight", className)} {...props}>{children}</p>;
}

export function SectionTitle({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h3 className={cn("font-bold text-xs uppercase tracking-widest text-primary", className)} {...props}>{children}</h3>;
}
