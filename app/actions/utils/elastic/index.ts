// This file is used to access the APM agent instance inside the application
// The agent is actually started via NODE_OPTIONS -r ./apm-preloader.js
let agent: any;

try {
	const apm = require("elastic-apm-node");
	if (apm.isStarted && apm.isStarted()) {
		agent = apm;
	}
} catch (e) {
	// Silent fail for build/client contexts
}

export const apmService = agent;
