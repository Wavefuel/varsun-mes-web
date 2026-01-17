import React from 'react';
import Link from 'next/link';

type AppHeaderProps = {
    title: string;
    subtitle?: React.ReactNode;
};

export default function AppHeader({ title, subtitle }: AppHeaderProps) {
    return (
        <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold font-display text-primary leading-tight tracking-tight">{title}</h1>
                    {subtitle && (
                        <div className="mt-0.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            {subtitle}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/login" className="size-9 rounded-full bg-primary/10 border-2 border-white overflow-hidden shadow-sm active:scale-95 transition-transform block">
                        <img
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLrhMm957VykfifDfbp6bEZXg3RrBcY9UPGk9fAK61AtrXuNdfPvN29M7n25JNQrNt5dwK5gM69-eukh4qEh1EJvtFwWbMf0uqpDC6FaL0sdc6R-uwNNsKncsQ2s21tRcCG93vatIuT6nxTUGvwMMqFnWXexLu9ltiELPfwE4EaxfPx-sXfxW7KhnfJEmPjY67V0Wo1CSaM0S_TxViLA8YxmAyACWI0RG7IkMJxRvGmb3PmTN2b0WFdSNqG0m5N5E-iXWN9xrhqg"
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    </Link>
                </div>
            </div>
        </header>
    );
}
