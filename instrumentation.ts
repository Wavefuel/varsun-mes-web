export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		// Importing the APM service only on the server runtime
		await import("./app/actions/utils/elastic/index");
	}
}
