import React from 'react';
import { cn } from '@/lib/utils';

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("bg-white border border-card-border rounded-xl card-shadow", className)} {...props}>
            {children}
        </div>
    );
}
