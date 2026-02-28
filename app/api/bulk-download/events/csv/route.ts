import { NextResponse } from "next/server";
import { batchReadDeviceStateEvents } from "@/utils/scripts";
import { buildDownloadFilename, parseDownloadRequest, toCsv, toTransactionRecords } from "../_shared";

export async function POST(request: Request) {
	try {
		const parsed = await parseDownloadRequest(request);
		const result = await batchReadDeviceStateEvents(parsed);
		const transactions = toTransactionRecords(result);
		const filename = buildDownloadFilename("csv");
		const csv = toCsv(transactions);

		return new NextResponse(csv, {
			status: 200,
			headers: {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `attachment; filename="${filename}"`,
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to fetch bulk download CSV.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
