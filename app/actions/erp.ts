"use server";
import "server-only";

import axios from "axios";
import { cookies } from "next/headers";

import { config } from "@/app/config";

const BASE_URL = "http://varsunind.proverp.com/";
const AUTH_URL = "identity/Account/Login";
const API_URL = "ERP/WorkCenterSchedule/GetSchedules";

const USER_ID = config.erp.userId || "apiuser";
const PASSWORD = config.erp.password || "V@rsun@2026";

interface ErpSession {
	cookies: string[];
	xsrfToken: string;
	lastAuthenticated: number;
}

const SESSION_COOKIE_NAME = "erp_session_store";

async function getStoredSession(): Promise<ErpSession | null> {
	const cookieStore = await cookies();
	const sessionStr = cookieStore.get(SESSION_COOKIE_NAME)?.value;
	if (!sessionStr) return null;
	try {
		return JSON.parse(sessionStr);
	} catch {
		return null;
	}
}

async function storeSession(session: ErpSession) {
	const cookieStore = await cookies();
	cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		maxAge: 60 * 60, // 1 hour
		path: "/",
	});
}

function formatCookieHeader(sessionCookies: string[]) {
	return sessionCookies.map((c) => c.split(";")[0]).join("; ");
}

function extractCookies(headers: any, currentCookies: string[] = []) {
	const setCookie = headers["set-cookie"];
	let newCookies = [...currentCookies];

	if (setCookie) {
		if (Array.isArray(setCookie)) {
			setCookie.forEach((c) => {
				const key = c.split("=")[0];
				// Remove existing cookie with same key
				newCookies = newCookies.filter((existing) => existing.split("=")[0] !== key);
				newCookies.push(c);
			});
		} else if (typeof setCookie === "string") {
			const key = setCookie.split("=")[0];
			newCookies = newCookies.filter((existing) => existing.split("=")[0] !== key);
			newCookies.push(setCookie);
		}
	}
	return newCookies;
}

export async function authenticateErp() {
	console.log("-> Authenticating with ERP...");
	try {
		// 1. Initial Handshake for XSRF
		const initResponse = await axios.get(BASE_URL, {
			maxRedirects: 5,
			validateStatus: () => true,
		});

		let sessionCookies = extractCookies(initResponse.headers);
		const xsrfToken = initResponse.headers["x-xsrf-token"] || initResponse.headers["X-XSRF-TOKEN"];

		if (!xsrfToken) {
			console.warn("Warning: XSRF Token not found during handshake");
		}

		// 2. Login
		const authPayload = { UserId: USER_ID, Password: PASSWORD };
		const loginResponse = await axios.post(`${BASE_URL}${AUTH_URL}`, authPayload, {
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				RequestVerificationToken: xsrfToken || "",
				Cookie: formatCookieHeader(sessionCookies),
			},
			maxRedirects: 5,
			validateStatus: () => true,
		});

		sessionCookies = extractCookies(loginResponse.headers, sessionCookies);

		if (loginResponse.status !== 200) {
			console.error("ERP Login Failed:", loginResponse.status, loginResponse.data);
			throw new Error("Failed to authenticate with ERP");
		}

		const session: ErpSession = {
			cookies: sessionCookies,
			xsrfToken: xsrfToken || "",
			lastAuthenticated: Date.now(),
		};

		await storeSession(session);
		console.log("-> ERP Login Success");
		return { success: true };
	} catch (error: any) {
		console.error("ERP Auth Error:", error.message);
		return { success: false, error: error.message };
	}
}

export async function refreshErpSession() {
	const session = await getStoredSession();
	if (!session) {
		return { success: false, error: "No session" };
	}

	try {
		console.log("-> Refreshing ERP Session (Heartbeat)...");
		// Just hitting the base URL with existing cookies to keep session alive
		const response = await axios.get(BASE_URL, {
			headers: { Cookie: formatCookieHeader(session.cookies) },
			validateStatus: () => true,
			timeout: 5000, // Short timeout for ping
		});

		if (response.status === 200) {
			// Update cookies if they rotated
			const updatedCookies = extractCookies(response.headers, session.cookies);
			session.cookies = updatedCookies;
			await storeSession(session);
			return { success: true };
		} else {
			// If we get a weird status, maybe session is dead
			console.warn("Heartbeat returned status:", response.status);
			return { success: false, error: "Heartbeat failed" };
		}
	} catch (error) {
		console.error("Heartbeat Error:", error);
		return { success: false, error: "Heartbeat network error" };
	}
}

export async function fetchErpSchedule(date: string, shiftCode?: string) {
	let session = await getStoredSession();

	// Helper to fetch data
	const tryFetch = async (s: ErpSession) => {
		const params: any = { workdayCode: date };
		if (shiftCode) {
			params.ShiftCode = shiftCode;
		}

		return await axios.get(`${BASE_URL}${API_URL}`, {
			params,
			headers: {
				Accept: "application/json",
				Cookie: formatCookieHeader(s.cookies),
			},
			validateStatus: () => true,
		});
	};

	if (!session) {
		console.log("-> No existing ERP session, logging in...");
		const authResult = await authenticateErp();
		if (!authResult.success) throw new Error("Could not login to ERP");
		session = await getStoredSession();
		if (!session) throw new Error("Session creation failed");
	}

	let response = await tryFetch(session);

	// If unauthorized, try re-login once
	if (response.status === 401 || response.status === 403) {
		console.log("-> ERP Session likely expired (server-side), re-authenticating...");
		await authenticateErp();
		session = await getStoredSession();
		if (session) {
			response = await tryFetch(session);
		}
	}

	if (response.status !== 200) {
		console.error("ERP Fetch Failed:", response.status);
		throw new Error(`Failed to fetch schedule: ${response.statusText}`);
	}

	// SUCCESS: Handle Session Keep-Alive

	// If session is somehow null here despite success (unlikely), strictly return data
	if (!session) return response.data;

	// 1. Capture any new/rotated cookies from the server
	const incomingCookies = response.headers["set-cookie"];
	if (incomingCookies) {
		console.log("-> Server returned new cookies, updating session...");
		session.cookies = extractCookies(response.headers, session.cookies);
	}

	// 2. Refresh our local cookie's expiration time (reset the 12h timer)
	// This ensures that as long as the user is active, the session doesn't die locally.
	// We do this even if cookies didn't change, just to extend the maxAge.
	await storeSession(session);
	console.log("-> Session timer extended locally due to activity.");

	return response.data;
}
