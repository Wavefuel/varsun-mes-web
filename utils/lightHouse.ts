import "server-only";
import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import { config } from "@/app/config";

const LIGHTHOUSE_API_URL = config.lighthouse.serverUrl;
const APPLICATION_SECRET_KEY = config.lighthouse.secretKey;

if (!LIGHTHOUSE_API_URL) {
	console.warn("WARNING: LIGHTHOUSE_API_URL is not set. Lighthouse API calls may fail.");
}

if (!APPLICATION_SECRET_KEY) {
	console.warn("WARNING: APPLICATION_SECRET_KEY is not set.");
}

const getHttpsAgent = () => {
	if (typeof window !== "undefined") return undefined;
	const https = require("https");
	return new https.Agent({
		rejectUnauthorized: false,
		keepAlive: true,
		maxSockets: Infinity,
	});
};

export const lightHouseAPIHandler: AxiosInstance = axios.create({
	baseURL: LIGHTHOUSE_API_URL,
	headers: {
		"Content-Type": "application/json",
		"x-application-code": config.app.code || "PSM",
		"x-application-secret-key": APPLICATION_SECRET_KEY || "",
	},
	timeout: 300000, // 5 minutes
	httpsAgent: getHttpsAgent(),
});

lightHouseAPIHandler.interceptors.request.use(
	async (config) => {
		const timestamp = Date.now();
		const crypto = require("crypto");
		const nonce = crypto.randomBytes(16).toString("hex");

		if (config.headers) {
			config.headers["X-Timestamp"] = timestamp;
			config.headers["X-Nonce"] = nonce;
		}

		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

// Add response interceptor
lightHouseAPIHandler.interceptors.response.use(
	(response: AxiosResponse) => {
		return response;
	},
	(error: AxiosError) => {
		let modError = {
			lighthouseError: true,
			...error,
		};
		return Promise.reject(modError);
	},
);
