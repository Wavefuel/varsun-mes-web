const fs = require('fs');
const path = require('path');

/**
 * Filter: Only start APM in the main Next.js server/dev process.
 * We want to avoid starting it in small worker threads or compilation processes
 * which cause "write after end" errors.
 */
const isMainProcess = process.argv.some(arg => arg.includes('next') && (arg.includes('dev') || arg.includes('start')));
const isWorker = process.env.NEXT_PRIVATE_WORKER === '1' || process.env.NODE_OPTIONS?.includes('--require'); // Check if it's a sub-spawn

// To be safe in dev, we look for 'dev' in the command
if (!isMainProcess && process.env.NODE_ENV !== 'production') {
    // Silent exit for non-essential processes
    return;
}

function getEnvMap() {
    const map = {};
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            content.split(/\r?\n/).forEach(line => {
                if (!line || line.startsWith('#')) return;
                const index = line.indexOf('=');
                if (index > -1) {
                    const key = line.substring(0, index).trim();
                    let value = line.substring(index + 1).trim();
                    value = value.replace(/^['"]|['"]$/g, '');
                    map[key] = value;
                }
            });
        }
    } catch (e) {}
    return map;
}

const envMap = getEnvMap();
const apmUrl = envMap.ELASTIC_APM_SERVER_URL || envMap.HALO_APM_URL;

if (!apmUrl) {
    console.log('⚠️ APM Preloader: No APM URL found, skipping agent start.');
    return;
}

const apmConfig = {
    serverUrl: apmUrl,
    secretToken: envMap.ELASTIC_APM_SECRET_TOKEN || envMap.HALO_APM_SECRET,
    serviceName: envMap.ELASTIC_APM_SERVICE_NAME || 'MES-VARSUN-WEB',
    environment: envMap.ELASTIC_APM_ENVIRONMENT || envMap.NODE_ENV || 'development',
    active: true,
    instrument: true,
    captureExceptions: true,
    captureHeaders: true,
    captureBody: "errors",
    logLevel: "warn", // Reduced noise
    transactionSampleRate: 1.0,
    metricsInterval: "30s",
    centralConfig: true,
    cloudProvider: "none",
    serviceNodeName: envMap.HOSTNAME || "node-1",
    frameworkName: envMap.APPLICATION_ID,
    // Reliability settings
    apiRequestSize: '2mb',
    apiRequestTime: '20s',
    errorMessageMaxLength: '2kb',
    globalLabels: {
        applicationId: envMap.APPLICATION_ID,
        appCode: envMap.WAVEFUEL_APPLICATION_CODE || "MES"
    }
};

try {
    const apm = require('elastic-apm-node');
    // Check if already started to avoid the "Do not call .start() more than once" error
    if (!apm.isStarted || !apm.isStarted()) {
        apm.start(apmConfig);
        console.log(`✅ APM Agent started [${process.pid}]. Target: ${apmConfig.serverUrl}`);
    }
} catch (err) {
    if (err.message !== 'Do not call .start() more than once') {
        console.error('❌ APM Preloader error:', err);
    }
}
