"use client";

import React from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import EmptyState from "@/components/EmptyState";
import Loader from "@/components/Loader";
import { useData } from "@/context/DataContext";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MetricValue, MetricLabel, SectionTitle } from "@/components/ui/Typography";

import { fetchDeviceList, readDeviceStateEventGroupsWithItemsByCluster, type DeviceSummary } from "@/utils/scripts";
import { formatTimeToIST, getISTDate } from "@/utils/dateUtils";
import { Assignment } from "@/lib/types";

type ApiEventItem = {
	id?: string;
	category?: string | null;
	segmentStart?: string | null;
	segmentEnd?: string | null;
	metadata?: Record<string, unknown> | null;
};
type ApiEventGroup = {
	id?: string;
	deviceId?: string;
	rangeStart?: string | null;
	rangeEnd?: string | null;
	Items?: ApiEventItem[] | null;
};

export default function Home() {
	const {
		orders,
		currentDate,
		setCurrentDate,
		globalAssignments,
		setGlobalAssignments,
		globalDevices,
		setGlobalDevices,
		globalDataDate,
		setGlobalDataDate,
		currentShift,
	} = useData();

	const lhtClusterId = process.env.NEXT_PUBLIC_LHT_CLUSTER_ID;
	const lhtAccountId = process.env.NEXT_PUBLIC_LHT_ACCOUNT_ID;
	const lhtApplicationId = process.env.NEXT_PUBLIC_APPLICATION_ID;
	const lighthouseEnabled = Boolean(lhtClusterId && lhtAccountId && lhtApplicationId);

	const [isError, setIsError] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);
	const deviceFetchRef = React.useRef(false);

	// Reset error when date changes
	React.useEffect(() => {
		setIsError(false);
	}, [currentDate]);

	// Fetch Devices if needed
	React.useEffect(() => {
		if (!lighthouseEnabled || !lhtClusterId) return;
		if (globalDevices.length) return;
		if (deviceFetchRef.current) return;
		deviceFetchRef.current = true;

		fetchDeviceList({ clusterId: lhtClusterId })
			.then((result) => setGlobalDevices(result))
			.catch((error) => {
				console.error(error);
				setIsError(true);
			});
	}, [globalDevices.length, lighthouseEnabled, lhtClusterId, setGlobalDevices]);

	// Fetch Assignments if needed
	React.useEffect(() => {
		if (!lighthouseEnabled || !lhtClusterId || !lhtAccountId) return;
		if (lighthouseEnabled && !globalDevices.length) return;
		if (globalDataDate === `${currentDate}:${currentShift}` && globalAssignments) {
			setIsLoading(false);
			return;
		}

		setIsLoading(true);

		const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
		const [year, month, day] = currentDate.split("-").map(Number);

		let startRange: string;
		let endRange: string;

		if (currentShift === "Day") {
			// Day Shift: 8 AM to 8 PM IST
			const start = Date.UTC(year, month - 1, day, 8, 0, 0, 0);
			const end = Date.UTC(year, month - 1, day, 20, 0, 0, 0);
			startRange = new Date(start - IST_OFFSET_MS).toISOString();
			endRange = new Date(end - IST_OFFSET_MS).toISOString();
		} else {
			// Night Shift: 8 PM to 8 AM next day IST
			const start = Date.UTC(year, month - 1, day, 20, 0, 0, 0);
			const end = Date.UTC(year, month - 1, day + 1, 8, 0, 0, 0);
			startRange = new Date(start - IST_OFFSET_MS).toISOString();
			endRange = new Date(end - IST_OFFSET_MS).toISOString();
		}

		const toLocalYYYYMMDD = (iso: string) => {
			const d = getISTDate(iso);
			if (!d) return "";
			return d.toISOString().split("T")[0];
		};

		const deviceLabel = (device?: DeviceSummary) =>
			device?.deviceName || device?.serialNumber || device?.foreignId || device?.id || "Unknown Device";

		let cancelled = false;

		readDeviceStateEventGroupsWithItemsByCluster({
			clusterId: lhtClusterId,
			applicationId: lhtApplicationId,
			account: { id: lhtAccountId },
			query: { rangeStart: startRange, rangeEnd: endRange },
		})
			.then((groupsUnknown: unknown) => {
				if (cancelled) return;
				const groups: ApiEventGroup[] = Array.isArray(groupsUnknown) ? (groupsUnknown as ApiEventGroup[]) : [];
				const mapped: any[] = groups.flatMap((group) => {
					const groupShift = currentShift === "Day" ? "Day Shift (S1)" : "Night Shift (S2)";

					const deviceId = typeof group?.deviceId === "string" ? group.deviceId : "";
					const machineName = (() => {
						if (!deviceId) return "Unknown Device";
						const device = globalDevices.find((d) => d.id === deviceId);
						if (!device) return deviceId;
						const label = deviceLabel(device);
						return label && label !== "Unknown Device" ? label : deviceId;
					})();

					const items = Array.isArray(group?.Items) ? group.Items : [];
					const rangeStartMs = new Date(startRange).getTime();
					const rangeEndMs = new Date(endRange).getTime();

					return items.flatMap((item) => {
						const segmentStart = item?.segmentStart ? new Date(item.segmentStart).getTime() : 0;
						if (segmentStart < rangeStartMs || segmentStart >= rangeEndMs) return [];

						const metadata = item?.metadata ?? {};
						const workOrder = String(metadata.workOrder ?? "");
						if (!workOrder) return [];
						const batch = Number(metadata.opBatchQty ?? 0);
						const estPart = String(metadata.estPartAdd ?? "");
						const startTime = formatTimeToIST(item?.segmentStart ?? undefined);
						const endTime = formatTimeToIST(item?.segmentEnd ?? undefined);
						const category = typeof item?.category === "string" ? String(item.category).toUpperCase() : "";
						const status = category === "COMPLETED" ? "COMPLETED" : "PLANNED";
						const groupId = String(group?.id ?? workOrder);
						const itemId = String(item?.id ?? "");

						return [
							{
								id: groupId,
								workOrder,
								partNumber: String(metadata.partNumber ?? ""),
								machine: machineName,
								operator: String(metadata.operatorCode ?? ""),
								date: currentDate,
								shift: groupShift,
								startTime,
								endTime,
								code: String(metadata.operatorCode ?? ""),
								opNumber: 0,
								batch,
								estPart,
								target: batch,
								status,
								actualOutput: Number(metadata.actualOutput ?? 0),
								toolChanges: Number(metadata.toolChanges ?? 0),
								rejects: Number(metadata.rejects ?? 0),
								lhtDeviceId: deviceId || undefined,
								lhtGroupId: groupId,
								lhtItemId: itemId,
							},
						];
					});
				});
				setGlobalAssignments(mapped);
				setGlobalDataDate(`${currentDate}:${currentShift}`);
			})
			.catch((error) => {
				if (cancelled) return;
				console.error(error);
				setGlobalAssignments([]);
				setIsError(true);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [
		currentDate,
		globalDevices,
		lighthouseEnabled,
		lhtAccountId,
		lhtApplicationId,
		lhtClusterId,
		globalAssignments,
		setGlobalAssignments,
		setGlobalDataDate,
		globalDataDate,
		currentShift,
	]);

	// Metrics Logic
	// Use globalAssignments if available (and we are in lighthouse mode), otherwise local orders
	const sourceOrders = lighthouseEnabled ? ((globalAssignments as any[]) ?? []) : orders;

	// Filter all orders by the global currentDate and currentShift
	const todaysOrders = sourceOrders.filter((o) => o.date === currentDate && (String(o.shift).includes(currentShift) || o.shift === currentShift));

	const activeOrders = todaysOrders.filter((o) => o.status === "PLANNED" || o.status === "ACTIVE");
	const completedOrders = todaysOrders.filter((o) => o.status === "COMPLETED");

	const activeCount = activeOrders.length;

	// Projected Output Metric: total actual vs total target for this shift
	const totalTarget = todaysOrders.reduce((sum, order) => sum + (order.target || 0), 0);
	const totalActual = todaysOrders.reduce((sum, order) => sum + (order.actualOutput || 0), 0);

	const formatNumber = (num: number) => {
		if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
		if (num >= 1000) return (num / 1000).toFixed(1) + "K";
		return num.toString();
	};

	const displayProjected = `${formatNumber(totalActual)} / ${formatNumber(totalTarget)}`;

	// Efficiency: (Actual / Target) * 100
	const efficiencyValue = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
	const displayEfficiency = efficiencyValue.toFixed(1) + "%";

	// Active Machines: Unique machines in active orders
	const activeMachines = new Set(activeOrders.map((o) => o.machine)).size;

	if (isError) {
		return (
			<div className="flex flex-col min-h-screen bg-background-dashboard">
				<AppHeader title="Production Overview" subtitle="Live Plant Metrics" showDateNavigator={true} />
				<div className="flex-1 flex flex-col items-center justify-center -mt-20">
					<EmptyState
						icon="cloud_off"
						title="Connection Failed"
						description={
							<span>
								Unable to retrieve dashboard data. <br />
								<span className="text-gray-400 text-xs mt-1 block">Please check your connection.</span>
							</span>
						}
						action={
							<button
								onClick={() => setIsError(false)}
								className="mt-2 h-9 px-6 rounded-lg bg-primary text-white font-bold text-xs shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 uppercase tracking-wide"
							>
								Retry
							</button>
						}
					/>
				</div>
			</div>
		);
	}

	if (isLoading || (lighthouseEnabled && globalAssignments === null)) {
		return (
			<div className="flex flex-col min-h-screen bg-background-dashboard">
				<AppHeader title="Production Overview" subtitle="Live Plant Metrics" showDateNavigator={true} />
				<div className="flex-1 flex flex-col items-center justify-center -mt-20">
					<Loader />
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen bg-background-dashboard">
			<AppHeader title="Production Overview" subtitle="Live Plant Metrics" showDateNavigator={true} />

			<main className="px-4 pb-4 space-y-4 pt-[16px]">
				{/* KPI Grid */}
				<section className="grid grid-cols-2 gap-3">
					<Card className="p-4">
						<div className="flex justify-between items-start mb-2">
							<span className="material-symbols-outlined text-primary !text-xl !leading-none py-0.5">assignment</span>
						</div>
						<MetricValue>{activeCount}</MetricValue>
						<MetricLabel>Active Work Orders</MetricLabel>
					</Card>
					<Card className="p-4">
						<div className="flex justify-between items-start mb-2">
							<span className="material-symbols-outlined text-green-600 !text-xl !leading-none py-0.5">bolt</span>
							{/* <Badge variant="success" className="px-1 py-0">
								Live
							</Badge> */}
						</div>
						<MetricValue>{displayEfficiency}</MetricValue>
						<MetricLabel>Plant Efficiency</MetricLabel>
					</Card>
					<Card className="p-4">
						<div className="flex justify-between items-start mb-2">
							<span className="material-symbols-outlined text-primary !text-xl !leading-none py-0.5">precision_manufacturing</span>
						</div>
						<MetricValue>{activeMachines}</MetricValue>
						<MetricLabel>Machines Active</MetricLabel>
					</Card>
					<Card className="p-4">
						<div className="flex justify-between items-start mb-2">
							<span className="material-symbols-outlined text-orange-500 !text-xl !leading-none py-0.5">trending_up</span>
						</div>
						<MetricValue>{displayProjected}</MetricValue>
						<MetricLabel>Production Progress</MetricLabel>
					</Card>
				</section>

				{/* Active Production List */}
				<section className="space-y-3">
					<div className="flex items-center justify-between px-1">
						<SectionTitle>Active Production</SectionTitle>
						<Link href="/planning" className="text-2xs font-bold text-gray-400 hover:text-primary transition-colors">
							VIEW ALL
						</Link>
					</div>

					<div className="space-y-3">
						{activeOrders.slice(0, 3).map((order) => {
							const displayId = (order as Assignment).workOrder || order.id;
							return (
								<Card key={order.id} className="p-4">
									<div className="flex justify-between items-start">
										<div>
											<p className="text-sm font-bold font-display text-primary">{displayId}</p>
											<p className="text-xs-plus text-gray-500 font-medium mt-0.5">
												{order.machine} • {order.operator}
											</p>
										</div>
										<Badge>{order.partNumber}</Badge>
									</div>
									{/* Progress Bar */}
									{(() => {
										const parseDate = (dStr: string, tStr: string, shift: string) => {
											if (!dStr || !tStr) return 0;
											const [y, m, d] = dStr.split("-").map(Number);
											const [time, modifier] = tStr.split(" ");
											let [h, min] = time.split(":").map(Number);
											if (modifier === "PM" && h < 12) h += 12;
											if (modifier === "AM" && h === 12) h = 0;

											const date = new Date(y, m - 1, d, h, min, 0);
											// If Night shift AND time is AM, it implies next day (crosses midnight)
											if (String(shift).includes("Night") && modifier === "AM") {
												date.setDate(date.getDate() + 1);
											}
											return date.getTime();
										};

										const start = parseDate(order.date, order.startTime, order.shift);
										const end = parseDate(order.date, order.endTime, order.shift);
										const now = Date.now();

										if (start && end && end > start) {
											const total = end - start;
											const elapsed = now - start;
											let progress = (elapsed / total) * 100;
											const isOverdue = now > end;

											// Clamp progress
											const barWidth = Math.max(0, Math.min(100, progress));

											return (
												<div className="mt-3">
													<div className="flex justify-between text-2xs font-bold text-gray-400 mb-1">
														<span>{order.startTime}</span>
														{isOverdue && <span className="text-red-500">Overdue</span>}
														<span>{order.endTime}</span>
													</div>
													<div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
														<div
															className={`h-full rounded-full transition-all duration-500 ${isOverdue ? "bg-red-500" : "bg-primary"}`}
															style={{ width: `${barWidth}%` }}
														/>
													</div>
												</div>
											);
										}
										return null;
									})()}
								</Card>
							);
						})}
						{activeOrders.length === 0 && <div className="text-center py-6 text-gray-400 text-xs font-bold">No active orders</div>}
					</div>
				</section>

				{/* Completed Work Orders */}
				<section className="space-y-3 pb-4">
					<div className="flex items-center justify-between px-1">
						<SectionTitle>Completed Orders</SectionTitle>
					</div>

					<Card className="overflow-hidden">
						<div className="divide-y divide-gray-100">
							{completedOrders.slice(0, 5).map((order) => {
								const displayId = (order as Assignment).workOrder || order.id;
								return (
									<div key={order.id} className="p-3 flex items-center justify-between">
										<div className="min-w-0">
											<p className="text-xs font-bold text-primary truncate">{displayId}</p>
											<p className="text-2xs text-gray-500 uppercase font-bold tracking-tight">{order.partNumber}</p>
										</div>
										<div className="text-right shrink-0">
											<p
												className={`text-xs-plus font-bold ${(() => {
													const actual = order.actualOutput || 0;
													const target = order.target || 1;
													const percent = (actual / target) * 100;
													if (percent < 75) return "text-red-500";
													if (percent < 90) return "text-amber-500";
													return "text-primary";
												})()}`}
											>
												{formatNumber(order.actualOutput || 0)} / {formatNumber(order.target || 0)}
											</p>
											<Link
												href={`/stock/${encodeURIComponent(order.id)}`}
												className="text-2xs font-bold text-primary/70 underline uppercase"
											>
												Details
											</Link>
										</div>
									</div>
								);
							})}
							{completedOrders.length === 0 && (
								<div className="p-4 text-center text-gray-400 text-xs font-bold">No completed orders yet</div>
							)}
						</div>
					</Card>
				</section>
			</main>
		</div>
	);
}
