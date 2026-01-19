"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const TIMEOUT_HOURS = Number(process.env.NEXT_PUBLIC_AUTH_TIMEOUT_HOURS) || 24;
const AUTH_TIMEOUT_MS = TIMEOUT_HOURS * 60 * 60 * 1000;
export const STORAGE_KEY = "lht_auth_timestamp";

export default function AuthGuard() {
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		const checkAuth = () => {
			// Allow public access to login page, but check if we should redirect out of it
			const storedTimestamp = localStorage.getItem(STORAGE_KEY);
			const now = Date.now();

			const isValidSession = storedTimestamp && !isNaN(parseInt(storedTimestamp)) && now - parseInt(storedTimestamp) < AUTH_TIMEOUT_MS;

			if (!isValidSession) {
				if (pathname !== "/login") {
					// Clear invalid session data just in case
					localStorage.removeItem(STORAGE_KEY);
					router.replace("/login");
				}
			} else {
				// Valid session
				if (pathname === "/login") {
					router.replace("/");
				}
			}
		};

		checkAuth();
	}, [pathname, router]);

	return null;
}
