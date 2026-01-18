import React from 'react';
import Link from 'next/link';

type AppHeaderProps = {
    title: string;
    subtitle?: React.ReactNode;
};

export default function AppHeader({ title, subtitle }: AppHeaderProps) {
    return (
        <header className="sticky top-0 z-50 bg-[var(--color-header-bg)] border-b border-card-border px-4 py-2 h-[var(--header-height)]">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="header-title">{title}</h1>
                    {subtitle && (
                        <div className="mt-0.5 header-subtitle uppercase flex items-center gap-1">
                            {subtitle}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-1 rounded-md active:scale-95 transition-transform hover:bg-gray-50">
                        <span className="material-symbols-outlined header-icon text-primary">
                            menu
                        </span>
                    </button>
                </div>
            </div>
        </header>
    );
}
