"use client";

import { useEffect, useRef } from "react";
import { refreshErpSession } from "@/app/actions/erp";
import { STORAGE_KEY } from "@/components/AuthGuard";

// 40 minutes in milliseconds
const HEARTBEAT_INTERVAL = 40 * 60 * 1000;

export default function ErpHeartbeat() {
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		const startHeartbeat = () => {
			// Clear any existing timer
			if (timerRef.current) clearInterval(timerRef.current);

			console.log("ERP Heartbeat system validated.");

			timerRef.current = setInterval(async () => {
				// Only ping if the user is locally authenticated
				const isLoggedIn = localStorage.getItem(STORAGE_KEY);

				if (isLoggedIn) {
					console.debug("Sending ERP heartbeat...");
					const result = await refreshErpSession();
					if (result.success) {
						console.debug("ERP session refreshed.");
					} else {
						console.warn("ERP session refresh failed:", result.error);
					}
				}
			}, HEARTBEAT_INTERVAL);
		};

		startHeartbeat();

		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, []);

	return null;
}
