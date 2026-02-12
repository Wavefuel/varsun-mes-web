import { z } from "zod";

const envSchema = z.object({
	// ElasticSearch Configuration
	HALO_ELASTICSEARCH_URL: z.string().url().optional(),
	HALO_ELASTICSEARCH_API_KEY: z.string().optional(),
	HALO_ELASTICSEARCH_USERNAME: z.string().optional(),
	HALO_ELASTICSEARCH_PASSWORD: z.string().optional(),
	HALO_SERVER_ES_INDEX_PREFIX: z.string().default("logs"),

	// Application Identity
	WAVEFUEL_APPLICATION_CODE: z.string().default("APP"),
	WAVEFUEL_ORGANIZATION_NAME: z.string().default("ORG"),
	WAVEFUEL_SERVER_NAME: z.string().default("SERVER"),

	// APM Configuration
	HALO_APM_URL: z.string().url().optional(),
	HALO_APM_SECRET: z.string().optional(),

	// Legacy/APM Environment Identify
	APPLICATION_CODE: z.string().optional(),
	ORGANIZATION_NAME: z.string().optional(),
	SERVER_NAME: z.string().optional(),
	HOSTNAME: z.string().optional(),
	pm_id: z.string().optional(),

	// Cluster Config
	LHT_CLUSTER_ID: z.string().optional(),
	LIGHTHOUSE_CLUSTER_ID: z.string().optional(), // Alias
	NEXT_PUBLIC_LHT_CLUSTER_ID: z.string().optional(),

	// Account/User Config
	LHT_ACCOUNT_ID: z.string().optional(),
	LHT_ACCOUNT_EMAIL: z.string().optional(),
	LHT_ACCOUNT_PASSWORD: z.string().optional(),

	// Lighthouse API Configuration
	LH_SERVER_URL: z.string().url().optional(),
	APPLICATION_ID: z.string().optional(),
	APPLICATION_SECRET_KEY: z.string().optional(),

	// Old/Next Public fallbacks (optional)
	NEXT_PUBLIC_LH_SERVER_URL: z.string().url().optional(),
	NEXT_PUBLIC_APPLICATION_ID: z.string().optional(),
	NEXT_PUBLIC_APPLICATION_SECRET_KEY: z.string().optional(),

	// ERP Configuration
	ERP_USER_ID: z.string().optional(),
	ERP_PASSWORD: z.string().optional(),

	// Environment
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	LOG_FILE_TRANSPORT: z.string().optional(),
});

// Validate environment variables
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
	console.error("❌ Invalid environment variables:", _env.error.format());
	// In production, we might want to throw an error here to prevent startup with bad config
	// For now, we'll log the error but allow partial success if optional fields are missing
	if (process.env.NODE_ENV === "production") {
		// throw new Error("Invalid environment variables");
	}
}

export const env = _env.success ? _env.data : process.env;
