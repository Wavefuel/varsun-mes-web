'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function BottomNav() {
    const pathname = usePathname();

    if (pathname === '/login') return null;

    const tabs = [
        { name: 'Home', href: '/', icon: 'home' },
        { name: 'Planning', href: '/planning', icon: 'calendar_month' },
        // Middle button is separate
        { name: 'Stock', href: '/stock', icon: 'inventory_2' },
        { name: 'Data', href: '/data', icon: 'analytics' },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 flex justify-between items-center z-50 max-w-[480px] mx-auto pb-safe safe-area-bottom">
            {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={cn(
                            "flex flex-col items-center gap-1 transition-colors w-16",
                            isActive ? "text-[#2D5A75]" : "text-gray-400"
                        )}
                    >
                        <span className={cn(
                            "material-symbols-outlined text-[24px]",
                            isActive && "font-variation-fill"
                        )}>
                            {tab.icon}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{tab.name}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
