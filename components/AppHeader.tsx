"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { STORAGE_KEY } from "./AuthGuard";
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
	rightElement?: React.ReactNode;
};

export default function AppHeader({ title, subtitle, showDateNavigator = false, dateNavigatorDisabled = false, rightElement }: AppHeaderProps) {
	const router = useRouter();
	const { currentDate, setCurrentDate } = useData();

	const handleLogout = () => {
		localStorage.removeItem(STORAGE_KEY);
		router.replace("/login");
	};

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
						{rightElement ? (
							rightElement
						) : (
							<button onClick={handleLogout} className="p-0.5 rounded-md active:scale-75 transition-transform hover:bg-gray-50 flex items-center justify-center">
								<span className="material-symbols-outlined !text-[19px] text-primary">logout</span>
							</button>
						)}
					</div>
				</div>
			</header>
			{showDateNavigator && (
				<div className="relative z-30 animate-in slide-in-from-top-1 fade-in duration-200 bg-[#eceff0] py-2 px-4">
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
