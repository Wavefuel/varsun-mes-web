"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export default function BottomNav() {
	const pathname = usePathname();

	if (pathname === "/login") return null;

	const tabs = [
		{ name: "Home", href: "/", icon: "home" },
		{ name: "Planning", href: "/planning", icon: "calendar_month" },
		{ name: "Stock", href: "/stock", icon: "inventory_2" },
		{ name: "Events", href: "/data", icon: "event_note" },
	];

	return (
		<footer className="footer-root">
			<nav className="flex justify-around items-center px-4 h-full max-w-[480px] mx-auto">
				{tabs.map((tab) => {
					const isActive = tab.href === "/" ? pathname === "/" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
					return (
						<Link
							key={tab.name}
							href={tab.href}
							className="flex flex-col items-center gap-[var(--gap-footer-item)] p-2 rounded-lg footer-link w-full transition-colors hover:bg-gray-50"
						>
							<span
								className={cn(
									"material-symbols-outlined transition-colors footer-icon",
									isActive ? "footer-active" : "footer-inactive",
								)}
							>
								{tab.icon}
							</span>
							<span className={cn("transition-colors uppercase footer-label", isActive ? "footer-active" : "footer-inactive")}>
								{tab.name}
							</span>
						</Link>
					);
				})}
			</nav>
		</footer>
	);
}
