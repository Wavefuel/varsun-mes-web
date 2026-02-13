import { env } from "@/app/actions/utils/env";
import { serverLogger } from "../logger/serverLogger";

// Initializing APM using a function to avoid top-level side effects during build/bundling
let apm: any;

if (process.env.NEXT_RUNTIME === "nodejs") {
	try {
		const agent = require("elastic-apm-node");

		// Ensure we don't start the agent multiple times
		if (!agent.isStarted || !agent.isStarted()) {
			// Configuration priority:
			// 1. .env file (via process.env injected by Next.js/Vercel)
			// 2. Fallbacks
			const apmConfig = {
				serverUrl: env.HALO_APM_URL || process.env.ELASTIC_APM_SERVER_URL,
				secretToken: env.HALO_APM_SECRET || process.env.ELASTIC_APM_SECRET_TOKEN,
				serviceName:
					env.WAVEFUEL_APPLICATION_CODE && env.WAVEFUEL_ORGANIZATION_NAME && env.WAVEFUEL_SERVER_NAME
						? `${env.WAVEFUEL_APPLICATION_CODE}-${env.WAVEFUEL_ORGANIZATION_NAME}-${env.WAVEFUEL_SERVER_NAME}`
						: process.env.ELASTIC_APM_SERVICE_NAME || "MES-VARSUN-WEB",
				serviceNodeName: env.HOSTNAME || "node-1",
				environment: process.env.ELASTIC_APM_ENVIRONMENT || env.NODE_ENV || "development",
				active: true,
				instrument: true,
				// catch exceptions
				captureExceptions: true,
				captureHeaders: true,
				captureBody: "errors",
				logLevel: "warn",
				transactionSampleRate: 1.0,
				// Vercel runs on AWS Lambda but standard AWS metadata fetching can cause timeouts
				// Setting to 'none' prevents the agent from hanging while trying to reach IMDS
				cloudProvider: "none",
				metricsInterval: "30s", // Metrics often fail in serverless due to short lifecycle; consider setting to 0s to disable if issues persist
				centralConfig: false, // Disable remote config fetching to avoid startup timeouts
				// Custom config compatible with labels
				frameworkName: process.env.APPLICATION_ID,
				globalLabels: {
					applicationId: process.env.APPLICATION_ID,
					appCode: process.env.WAVEFUEL_APPLICATION_CODE || "MES",
				},
			};

			// Start the agent
			apm = agent.start(apmConfig);
			console.log(`✅ Elastic APM Agent started. Service: ${apmConfig.serviceName}`);
		} else {
			apm = agent;
			console.log("✅ Elastic APM Agent already active.");
		}

		// Set up error handling logging
		if (apm && typeof apm.handleUncaughtExceptions === "function") {
			apm.handleUncaughtExceptions((err: Error) => {
				serverLogger.error("Uncaught Exception handled by APM:", {
					error: err.message,
					stack: err.stack,
				});
			});
		}
	} catch (error) {
		console.error("❌ Failed to initialize Elastic APM:", error);
	}
}

export const apmService = apm;
