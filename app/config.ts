import { env } from "@/app/actions/utils/env";

export const config = {
	lighthouse: {
		clusterId: env.LHT_CLUSTER_ID || env.LIGHTHOUSE_CLUSTER_ID || env.NEXT_PUBLIC_LHT_CLUSTER_ID,
		serverUrl: env.LH_SERVER_URL || env.NEXT_PUBLIC_LH_SERVER_URL,
		applicationId: env.APPLICATION_ID || env.NEXT_PUBLIC_APPLICATION_ID,
		secretKey: env.APPLICATION_SECRET_KEY || env.NEXT_PUBLIC_APPLICATION_SECRET_KEY,
		// Account / User context (optional, mainly for specific scripts)
		accountId: env.LHT_ACCOUNT_ID,
		accountEmail: env.LHT_ACCOUNT_EMAIL,
		accountPassword: env.LHT_ACCOUNT_PASSWORD,
	},
	erp: {
		userId: env.ERP_USER_ID,
		password: env.ERP_PASSWORD,
	},
	app: {
		code: env.WAVEFUEL_APPLICATION_CODE,
		org: env.WAVEFUEL_ORGANIZATION_NAME,
		serverName: env.WAVEFUEL_SERVER_NAME,
	},
	elastic: {
		url: env.HALO_ELASTICSEARCH_URL,
		apiKey: env.HALO_ELASTICSEARCH_API_KEY,
		username: env.HALO_ELASTICSEARCH_USERNAME,
		password: env.HALO_ELASTICSEARCH_PASSWORD,
		indexPrefix: env.HALO_SERVER_ES_INDEX_PREFIX,
		apmUrl: env.HALO_APM_URL,
		apmSecret: env.HALO_APM_SECRET,
	},
};
