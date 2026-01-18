import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

interface EmptyStateProps {
	icon: string;
	title: string;
	description: React.ReactNode;
	className?: string;
	action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, className, action }: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center py-10 px-4 text-center animate-in fade-in zoom-in-95 duration-300 font-display",
				className,
			)}
		>
			<div className="size-16 rounded-2xl bg-gradient-to-b from-white to-gray-50 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)] border border-white ring-1 ring-gray-100 flex items-center justify-center mb-5">
				<span className="material-symbols-outlined text-gray-400 text-[28px]">{icon}</span>
			</div>
			<h3 className="text-base font-bold text-gray-900 uppercase tracking-wider mb-1.5">{title}</h3>
			<div className="text-sm font-medium text-gray-500 leading-snug">{description}</div>
			{action && <div className="mt-6">{action}</div>}
		</div>
	);
}
