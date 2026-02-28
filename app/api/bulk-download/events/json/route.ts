import { NextResponse } from "next/server";
import { batchReadDeviceStateEvents } from "@/utils/scripts";
import { buildDownloadFilename, parseDownloadRequest, toTransactionRecords } from "../_shared";

export async function POST(request: Request) {
	try {
		const parsed = await parseDownloadRequest(request);
		const result = await batchReadDeviceStateEvents(parsed);
		const transactions = toTransactionRecords(result);
		const filename = buildDownloadFilename("json");

		return new NextResponse(JSON.stringify(transactions, null, 2), {
			status: 200,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Content-Disposition": `attachment; filename="${filename}"`,
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to fetch bulk download JSON.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
