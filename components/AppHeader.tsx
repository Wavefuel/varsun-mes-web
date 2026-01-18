import React from "react";
import Link from "next/link";
import DateNavigator from "./DateNavigator";
import { useData } from "@/context/DataContext";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for class merging
function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

type AppHeaderProps = {
	title: string;
	subtitle?: React.ReactNode;
	showDateNavigator?: boolean;
	dateNavigatorDisabled?: boolean;
};

export default function AppHeader({ title, subtitle, showDateNavigator = false, dateNavigatorDisabled = false }: AppHeaderProps) {
	const { currentDate, setCurrentDate } = useData();

	return (
		<>
			<header
				className={cn(
					"sticky top-0 z-50 bg-[var(--color-header-bg)] border-b border-card-border px-4 transition-all",
					showDateNavigator ? "h-[var(--header-height-expanded)] py-2 flex flex-col justify-between" : "h-[var(--header-height)] py-2",
				)}
			>
				<div className="flex items-center justify-between">
					<div className="flex flex-col">
						<h1 className="header-title">{title}</h1>
						{subtitle && <div className="mt-0.5 header-subtitle uppercase flex items-center gap-1">{subtitle}</div>}
					</div>
					<div className="flex items-center gap-3">
						<button className="p-1 rounded-md active:scale-95 transition-transform hover:bg-gray-50">
							<span className="material-symbols-outlined header-icon text-primary">menu</span>
						</button>
					</div>
				</div>
			</header>
			{showDateNavigator && (
				<div className="animate-in slide-in-from-top-1 fade-in duration-200 bg-[#eceff0] py-2 px-4">
					<DateNavigator
						currentDate={currentDate}
						setCurrentDate={setCurrentDate}
						disabled={dateNavigatorDisabled}
						className="p-0 border-dashed border-gray-100"
					/>
				</div>
			)}
		</>
	);
}
