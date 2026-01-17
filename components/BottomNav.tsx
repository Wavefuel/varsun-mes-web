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
        { name: 'Stock', href: '/stock', icon: 'inventory_2' },
        { name: 'Data', href: '/data', icon: 'bar_chart' },
    ];

    return (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe safe-area-bottom">
            <nav className="flex justify-around items-center px-4 py-2 max-w-[480px] mx-auto">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href;
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg group hover:bg-gray-50 w-full transition-colors"
                        >
                            <span className={cn(
                                "material-symbols-outlined text-[20px] transition-colors",
                                isActive ? "text-[#2D5A75]" : "text-slate-500 group-hover:text-[#2D5A75]"
                            )}>
                                {tab.icon}
                            </span>
                            <span className={cn(
                                "text-[10px] font-medium transition-colors",
                                isActive ? "text-[#2D5A75]" : "text-slate-500 group-hover:text-[#2D5A75]"
                            )}>
                                {tab.name}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </footer>
    );
}
