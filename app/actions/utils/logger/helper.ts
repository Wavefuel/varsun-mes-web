import "server-only";

// Type definitions
type LogLevel = "INFO" | "ERROR" | "WARN" | "DEBUG";

interface LogInput {
	level: LogLevel;
	message: string;
	meta?: {
		meta?: Record<string, any>;
	};
}

interface TransformedLog {
	severity: LogLevel;
	"@timestamp": string;
	processId: string | null;
	message: string;
	callStack: string | null;
	metadata: Record<string, any>;
	data: Record<string, any>;
}

const TYPE_SUFFIXES = {
	STRING: "_str",
	INTEGER: "_long",
	DOUBLE: "_double",
	DATE: "_date",
	BOOLEAN: "_bool",
	OBJECT: "_object",
	ARRAY_STRING: "_arr_str",
	ARRAY_INTEGER: "_arr_long",
	ARRAY_DOUBLE: "_arr_double",
	ARRAY_BOOLEAN: "_arr_bool",
	ARRAY_OBJECT: "_arr_object",
} as const;

const typeCheckers = {
	isDate: (value: any): boolean => {
		if (value instanceof Date) return true;
		if (typeof value !== "string") return false;
		const datePatterns = [/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?$/, /^\d{4}-\d{2}-\d{2}$/];
		const isValidFormat = datePatterns.some((pattern) => pattern.test(value));
		if (!isValidFormat) return false;
		const date = new Date(value);
		return !isNaN(date.getTime());
	},
	isNumeric: (value: string): boolean => {
		return typeof value === "string" && /^-?\d*\.?\d+$/.test(value) && !isNaN(parseFloat(value)) && isFinite(Number(value));
	},
	isInteger: (value: number): boolean => Number.isInteger(value),
	isObject: (value: any): boolean => typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date),
};

const valueParser = {
	parseValue: (value: any): any => {
		if (typeof value !== "string") return value;
		if (!value.trim()) return value;
		if (typeCheckers.isNumeric(value)) {
			const parsed = parseFloat(value);
			return parsed.toString() === value ? parsed : value;
		}
		return value;
	},
};

const addSuffix = (obj: any, keyName: string): any => {
	if (typeCheckers.isObject(obj)) {
		const processedObj: Record<string, any> = {};
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				let processedValue = valueParser.parseValue(obj[key]);
				let newKey = key;
				if (typeof processedValue === "string") {
					newKey += typeCheckers.isDate(processedValue) ? TYPE_SUFFIXES.DATE : TYPE_SUFFIXES.STRING;
				} else if (typeof processedValue === "number") {
					newKey += typeCheckers.isInteger(processedValue) ? TYPE_SUFFIXES.INTEGER : TYPE_SUFFIXES.DOUBLE;
				}
				processedObj[newKey] = processedValue;
			}
		}
		return processedObj;
	}
	return obj;
};

const customTransformer = (log: LogInput): TransformedLog => {
	const timestamp = new Date().toISOString();
	let meta = {};
	let data = {};

	if (log.meta?.meta) {
		const parsedMeta = { ...log.meta.meta };
		if (parsedMeta.ref) {
			data = addSuffix(parsedMeta.ref, "ref");
			delete parsedMeta.ref;
		}
		meta = parsedMeta;
	}

	return {
		severity: log.level,
		"@timestamp": timestamp,
		processId: null,
		message: log.message,
		callStack: null,
		metadata: meta,
		data: data,
	};
};

export default customTransformer;
