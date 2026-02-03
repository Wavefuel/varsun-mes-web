import React, { useState, useMemo } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export interface SyncChangeItem {
	id: string; // Unique ID for selection/key
	type: "ADD" | "UPDATE" | "DELETE";
	title: string; // e.g. "Work Order 12345"
	subtitle?: string; // e.g. "Machine: CNC-01 • Part: X-99"
	diff?: string; // e.g. "Qty: 50 → 100"
	payload: any; // Internal data for execution
}

interface SyncPreviewModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (selectedChanges: { adds: SyncChangeItem[]; updates: SyncChangeItem[]; deletes: SyncChangeItem[] }) => void;
	changes: {
		adds: SyncChangeItem[];
		updates: SyncChangeItem[];
		deletes: SyncChangeItem[];
	};
	isExecuting?: boolean;
}

export default function SyncPreviewModal({ isOpen, onClose, onConfirm, changes, isExecuting }: SyncPreviewModalProps) {
	const [selectedAdds, setSelectedAdds] = useState<Set<string>>(new Set(changes.adds.map((i) => i.id)));
	const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set(changes.updates.map((i) => i.id)));
	const [selectedDeletes, setSelectedDeletes] = useState<Set<string>>(new Set(changes.deletes.map((i) => i.id)));
	const [activeTab, setActiveTab] = useState<"ADD" | "UPDATE" | "DELETE">("ADD");

	// Reset selections when changes prop updates (new sync)
	React.useEffect(() => {
		if (isOpen) {
			setSelectedAdds(new Set(changes.adds.map((i) => i.id)));
			setSelectedUpdates(new Set(changes.updates.map((i) => i.id)));
			setSelectedDeletes(new Set(changes.deletes.map((i) => i.id)));
			// Default to the first tab that has items
			if (changes.adds.length > 0) setActiveTab("ADD");
			else if (changes.updates.length > 0) setActiveTab("UPDATE");
			else if (changes.deletes.length > 0) setActiveTab("DELETE");
		}
	}, [isOpen, changes]);

	if (!isOpen) return null;

	const toggleItem = (id: string, set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>) => {
		const newSet = new Set(set);
		if (newSet.has(id)) newSet.delete(id);
		else newSet.add(id);
		setFn(newSet);
	};

	const toggleAll = (items: SyncChangeItem[], set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>) => {
		if (set.size === items.length) {
			setFn(new Set());
		} else {
			setFn(new Set(items.map((i) => i.id)));
		}
	};

	const handleConfirm = () => {
		onConfirm({
			adds: changes.adds.filter((i) => selectedAdds.has(i.id)),
			updates: changes.updates.filter((i) => selectedUpdates.has(i.id)),
			deletes: changes.deletes.filter((i) => selectedDeletes.has(i.id)),
		});
	};

	const counts = {
		ADD: changes.adds.length,
		UPDATE: changes.updates.length,
		DELETE: changes.deletes.length,
	};

	const currentList = activeTab === "ADD" ? changes.adds : activeTab === "UPDATE" ? changes.updates : changes.deletes;
	const currentSet = activeTab === "ADD" ? selectedAdds : activeTab === "UPDATE" ? selectedUpdates : selectedDeletes;
	const currentSetFn = activeTab === "ADD" ? setSelectedAdds : activeTab === "UPDATE" ? setSelectedUpdates : setSelectedDeletes;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
			<div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
				{/* Header */}
				<div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
					<div>
						<h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
							<span className="material-symbols-outlined text-primary">cloud_sync</span>
							Review ERP Sync
						</h2>
						<p className="text-xs text-gray-500 mt-0.5">Select the changes you want to apply to your plan.</p>
					</div>
					<button onClick={onClose} disabled={isExecuting} className="text-gray-400 hover:text-gray-600">
						<span className="material-symbols-outlined">close</span>
					</button>
				</div>

				{/* Tabs */}
				<div className="flex border-b px-6 gap-6">
					{(["ADD", "UPDATE", "DELETE"] as const).map((tab) => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							className={cn(
								"py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2",
								activeTab === tab
									? "border-primary text-primary"
									: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200",
							)}
						>
							<span>
								{tab === "ADD" && "New Items"}
								{tab === "UPDATE" && "Updates"}
								{tab === "DELETE" && "Removals"}
							</span>
							<span
								className={cn(
									"px-1.5 py-0.5 rounded-full text-[10px]",
									counts[tab] > 0 ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-300",
								)}
							>
								{counts[tab]}
							</span>
						</button>
					))}
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-0 bg-gray-50/30">
					{currentList.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-48 text-gray-400">
							<span className="material-symbols-outlined text-3xl mb-2 opacity-20">check_circle</span>
							<p className="text-sm">No {activeTab.toLowerCase()} actions pending.</p>
						</div>
					) : (
						<div>
							<div className="px-6 py-2 bg-gray-50 border-b flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm bg-gray-50/90">
								<label className="flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer">
									<input
										type="checkbox"
										className="rounded border-gray-300 text-primary focus:ring-primary"
										checked={currentList.length > 0 && currentSet.size === currentList.length}
										onChange={() => toggleAll(currentList, currentSet, currentSetFn)}
									/>
									Select All ({currentList.length})
								</label>
							</div>
							<div className="divide-y">
								{currentList.map((item) => (
									<div
										key={item.id}
										className={cn(
											"px-6 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors cursor-pointer",
											currentSet.has(item.id) ? "bg-primary/5" : "",
										)}
										onClick={() => toggleItem(item.id, currentSet, currentSetFn)}
									>
										<div className="pt-0.5">
											<input
												type="checkbox"
												className="rounded border-gray-300 text-primary focus:ring-primary"
												checked={currentSet.has(item.id)}
												onChange={() => {}} // Handled by parent div
											/>
										</div>
										<div className="flex-1">
											<div className="flex justify-between items-start">
												<h4 className="text-sm font-medium text-gray-900">{item.title}</h4>
												{item.type === "UPDATE" && (
													<span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
														Modified
													</span>
												)}
												{item.type === "ADD" && (
													<span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
														New
													</span>
												)}
												{item.type === "DELETE" && (
													<span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
														To Remove
													</span>
												)}
											</div>
											<p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
											{item.diff && (
												<div className="mt-1.5 text-xs bg-white border border-gray-200 rounded px-2 py-1 text-gray-600 font-mono">
													{item.diff}
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="p-4 border-t bg-white flex justify-end gap-3">
					<button
						onClick={onClose}
						disabled={isExecuting}
						className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={handleConfirm}
						disabled={isExecuting}
						className={cn(
							"px-4 py-2 text-sm font-bold text-white rounded-lg transition-all flex items-center gap-2",
							isExecuting ? "bg-primary/70 cursor-wait" : "bg-primary hover:bg-primary/90 shadow-md shadow-primary/20",
							selectedAdds.size + selectedUpdates.size + selectedDeletes.size === 0 && "opacity-50 cursor-not-allowed",
						)}
					>
						{isExecuting && <span className="material-symbols-outlined text-sm animate-spin">sync</span>}
						{isExecuting ? "Applying Changes..." : `Apply (${selectedAdds.size + selectedUpdates.size + selectedDeletes.size}) Changes`}
					</button>
				</div>
			</div>
		</div>
	);
}
