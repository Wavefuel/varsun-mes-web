import axios, { AxiosRequestConfig, AxiosInstance, AxiosResponse, AxiosError } from "axios";
import https from "https";
import crypto from "crypto";

const LIGHTHOUSE_API_URL = process.env.NEXT_PUBLIC_LH_SERVER_URL;
// if (!process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY) {
// 	throw new Error("NEXT_PUBLIC_APPLICATION_SECRET_KEY is not set");
// }
export const lightHouseAPIHandler: AxiosInstance = axios.create({
	baseURL: LIGHTHOUSE_API_URL,
	headers: {
		"Content-Type": "application/json",
		"x-application-code": "PSM",
		"x-application-secret-key": process.env.NEXT_PUBLIC_APPLICATION_SECRET_KEY!,
	},
	timeout: 30000, // 30 seconds
	httpsAgent: new https.Agent({
		rejectUnauthorized: false,
		keepAlive: true,
		maxSockets: Infinity,
	}),
});

lightHouseAPIHandler.interceptors.request.use(
	async (config) => {
		// console.log("Full Request Config:", JSON.stringify(config, null, 2));
		const timestamp = Date.now();
		const nonce = crypto.randomBytes(16).toString("hex");

		config.headers!["X-Timestamp"] = timestamp;
		config.headers!["X-Nonce"] = nonce;

		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Add response interceptor
lightHouseAPIHandler.interceptors.response.use(
	(response: AxiosResponse) => {
		// You can modify the response here if needed
		return response;
	},
	(error: AxiosError) => {	
		// console.error("Full Axios Error:", error);
		// Log or process errors
		let modError = {
			lighthouseError: true,
			...error,
		};
		// You can modify the error or perform additional actions here
		return Promise.reject(modError);
	}
);
