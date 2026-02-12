"use server";

import { env } from "@/app/actions/utils/env";

export async function login(formData: FormData) {
	const email = formData.get("email") as string;
	const password = formData.get("password") as string;

	const configEmail = env.LHT_ACCOUNT_EMAIL || process.env.NEXT_PUBLIC_LHT_ACCOUNT_EMAIL;
	const configPassword = env.LHT_ACCOUNT_PASSWORD || process.env.NEXT_PUBLIC_LHT_ACCOUNT_PASSWORD;

	if (email === configEmail && password === configPassword) {
		return { success: true };
	}

	return { success: false, error: "Invalid credentials" };
}
