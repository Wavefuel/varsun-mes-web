import "server-only";
import { Client } from "@elastic/elasticsearch";
import { logger } from "wavefuel-utils";
import path from "path";
import customTransformer from "./helper";
import { env } from "../env";

const projectRoot = path.join(process.cwd(), `./logs/server`);

// Configure Elasticsearch client
const esClient = new Client({
	node: env.HALO_ELASTICSEARCH_URL || "http://localhost:9200",
	name: `${env.WAVEFUEL_APPLICATION_CODE}-server`,
	auth: env.HALO_ELASTICSEARCH_API_KEY
		? { apiKey: env.HALO_ELASTICSEARCH_API_KEY }
		: env.HALO_ELASTICSEARCH_USERNAME && env.HALO_ELASTICSEARCH_PASSWORD
			? {
					username: env.HALO_ELASTICSEARCH_USERNAME,
					password: env.HALO_ELASTICSEARCH_PASSWORD,
				}
			: undefined,
});

const esTransportOpts = {
	level: "trace",
	client: esClient,
	dataStream: true,
	index: env.HALO_SERVER_ES_INDEX_PREFIX || "logs",
	transformer: customTransformer,
	useTransformer: true,
};

const loggerOptions: any = {
	consoleLevel: "trace",
	isStack: true,
	rotate: true,
	levels: {
		fatal: { severity: 0, transport: false },
		error: { severity: 0, transport: true },
		warn: { severity: 1, transport: false },
		info: { severity: 2, transport: true },
		debug: { severity: 3, transport: false },
		trace: { severity: 4, transport: true },
	},
	elastic: esTransportOpts,
	disableFileTransport: env.LOG_FILE_TRANSPORT === "false",
};

// Initiate internal logger from wavefuel-utils
const internalLogger = logger.initiateLogger(projectRoot, loggerOptions);

export const serverLogger = {
	info: (message: string, meta?: any) => internalLogger.info(message, meta),
	error: (message: string, meta?: any) => internalLogger.error(message, meta),
	warn: (message: string, meta?: any) => internalLogger.warn(message, meta),
	debug: (message: string, meta?: any) => internalLogger.debug(message, meta),
};
