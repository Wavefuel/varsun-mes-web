import type { NextConfig } from "next";
const withPWA = require("@ducanh2912/next-pwa").default({
	dest: "public",
	cacheOnFrontEndNav: true,
	aggressiveFrontEndNavCaching: true,
	reloadOnOnline: true,
	swMinify: true,
	disable: process.env.NODE_ENV === "development",
	workboxOptions: {
		disableDevLogs: true,
	},
});

const nextConfig: NextConfig = {
	/* config options here */
	reactCompiler: true,
	serverExternalPackages: ["elastic-apm-node", "wavefuel-utils", "@elastic/elasticsearch"],
	webpack: (config, { isServer }) => {
		if (isServer) {
			config.ignoreWarnings = [
				{ module: /opentelemetry/ },
				{ module: /elastic-apm-node/ },
				{ module: /wavefuel-utils/ },
				{ message: /Critical dependency: the request of a dependency is an expression/ },
			];
			config.externals.push({
				"@azure/functions-core": "commonjs @azure/functions-core",
				https: "commonjs https",
				http: "commonjs http",
				crypto: "commonjs crypto",
				os: "commonjs os",
				fs: "commonjs fs",
				path: "commonjs path",
			});
		}
		return config;
	},
};

export default withPWA(nextConfig);
