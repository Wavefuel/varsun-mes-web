import React from 'react';
import { toast } from 'sonner';

interface CustomToastProps {
    t: string | number;
    title: string;
    message: React.ReactNode;
    type?: 'error' | 'success';
    actions?: React.ReactNode;
}

export const CustomToast = ({ t, title, message, type = 'error', actions }: CustomToastProps) => {
    const isError = type === 'error';

    // Config based on type
    const config = isError ? {
        bg: 'bg-red-50',
        border: 'border-red-100',
        strap: 'bg-red-500',
        icon: 'warning',
        iconColor: 'text-red-600',
        titleColor: 'text-red-900',
        textColor: 'text-red-900/80',
        actionColor: 'text-red-700',
        closeBtn: 'text-red-400 hover:text-red-700 hover:bg-red-100',
    } : {
        bg: 'bg-green-50',
        border: 'border-green-100',
        strap: 'bg-green-500',
        icon: 'check_circle',
        iconColor: 'text-green-600',
        titleColor: 'text-green-900',
        textColor: 'text-green-900/80',
        actionColor: 'text-green-700',
        closeBtn: 'text-green-400 hover:text-green-700 hover:bg-green-100',
    };

    return (
        <div className={`w-full flex items-stretch ${config.bg} border ${config.border} shadow-md overflow-hidden rounded-none`}>
            {/* Left Strap */}
            <div className={`w-1.5 ${config.strap} shrink-0`} />

            {/* Content */}
            <div className="flex-1 p-3.5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined ${config.iconColor} text-[20px]`}>{config.icon}</span>
                        <h3 className={`font-bold ${config.titleColor} text-sm`}>{title}</h3>
                    </div>
                    <button
                        onClick={() => toast.dismiss(t)}
                        className={`transition-colors -mt-0.5 -mr-1 rounded-sm p-0.5 ${config.closeBtn}`}
                    >
                        <span className="material-symbols-outlined text-[16px] block">close</span>
                    </button>
                </div>

                <div className="pl-[28px] mt-1.5 space-y-1">
                    <div className={`text-xs ${config.textColor} leading-relaxed`}>
                        {message}
                    </div>
                    {actions && (
                        <div className={`text-[11px] ${config.actionColor} font-medium`}>
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
