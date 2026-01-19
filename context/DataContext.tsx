"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Order, MOCK_INITIAL_ORDERS, Assignment } from "@/lib/types";
import { DeviceSummary } from "@/utils/scripts";

interface DataContextType {
	orders: Order[];
	addOrder: (order: Order) => void;
	updateOrder: (id: string, updates: Partial<Order>) => void;
	getOrderById: (id: string) => Order | undefined;
	deleteOrder: (id: string) => void;
	currentDate: string;
	setCurrentDate: (date: string) => void;
	currentShift: "Day" | "Night";
	setCurrentShift: (shift: "Day" | "Night") => void;
	planningAssignments: Assignment[] | null;
	setPlanningAssignments: React.Dispatch<React.SetStateAction<Assignment[] | null>>;
	planningDevices: DeviceSummary[];
	setPlanningDevices: React.Dispatch<React.SetStateAction<DeviceSummary[]>>;
	planningDataDate: string | null;
	setPlanningDataDate: React.Dispatch<React.SetStateAction<string | null>>;
	stockOrders: Order[] | null;
	setStockOrders: React.Dispatch<React.SetStateAction<Order[] | null>>;
	stockDevices: DeviceSummary[];
	setStockDevices: React.Dispatch<React.SetStateAction<DeviceSummary[]>>;
	stockDataDate: string | null;
	setStockDataDate: React.Dispatch<React.SetStateAction<string | null>>;
	eventsData: any[] | null;
	setEventsData: React.Dispatch<React.SetStateAction<any[] | null>>;
	eventsDevices: DeviceSummary[];
	setEventsDevices: React.Dispatch<React.SetStateAction<DeviceSummary[]>>;
	eventsDataDate: string | null;
	setEventsDataDate: React.Dispatch<React.SetStateAction<string | null>>;
	// Global State
	globalAssignments: Assignment[] | null;
	setGlobalAssignments: React.Dispatch<React.SetStateAction<Assignment[] | null>>;
	globalDevices: DeviceSummary[];
	setGlobalDevices: React.Dispatch<React.SetStateAction<DeviceSummary[]>>;
	globalDataDate: string | null;
	setGlobalDataDate: React.Dispatch<React.SetStateAction<string | null>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
	const [orders, setOrders] = useState<Order[]>([]);
	const [currentDate, setCurrentDate] = useState(new Date().toISOString().split("T")[0]);
	const [currentShift, setCurrentShift] = useState<"Day" | "Night">("Day");
	const [planningAssignments, setPlanningAssignments] = useState<Assignment[] | null>(null);
	const [planningDevices, setPlanningDevices] = useState<DeviceSummary[]>([]);
	const [planningDataDate, setPlanningDataDate] = useState<string | null>(null);
	const [stockOrders, setStockOrders] = useState<Order[] | null>(null);
	const [stockDevices, setStockDevices] = useState<DeviceSummary[]>([]);
	const [stockDataDate, setStockDataDate] = useState<string | null>(null);
	const [eventsData, setEventsData] = useState<any[] | null>(null);
	const [eventsDevices, setEventsDevices] = useState<DeviceSummary[]>([]);
	const [eventsDataDate, setEventsDataDate] = useState<string | null>(null);

	// Global State
	const [globalAssignments, setGlobalAssignments] = useState<Assignment[] | null>(null);
	const [globalDevices, setGlobalDevices] = useState<DeviceSummary[]>([]);
	const [globalDataDate, setGlobalDataDate] = useState<string | null>(null);

	useEffect(() => {
		// Load from local storage or use mock
		const saved = localStorage.getItem("mes_orders");
		if (saved) {
			try {
				setOrders(JSON.parse(saved));
			} catch (e) {
				console.error("Failed to parse orders", e);
				setOrders(MOCK_INITIAL_ORDERS);
			}
		} else {
			setOrders(MOCK_INITIAL_ORDERS);
		}
	}, []);

	useEffect(() => {
		if (orders.length > 0) {
			localStorage.setItem("mes_orders", JSON.stringify(orders));
		}
	}, [orders]);

	const addOrder = (order: Order) => {
		setOrders((prev) => [order, ...prev]);
	};

	const updateOrder = (id: string, updates: Partial<Order>) => {
		setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
	};

	const getOrderById = (id: string) => orders.find((o) => o.id === id);

	const deleteOrder = (id: string) => {
		setOrders((prev) => prev.filter((o) => o.id !== id));
	};

	return (
		<DataContext.Provider
			value={{
				orders,
				addOrder,
				updateOrder,
				getOrderById,
				deleteOrder,
				currentDate,
				setCurrentDate,
				currentShift,
				setCurrentShift,
				planningAssignments,
				setPlanningAssignments,
				planningDevices,
				setPlanningDevices,
				planningDataDate,
				setPlanningDataDate,
				stockOrders,
				setStockOrders,
				stockDevices,
				setStockDevices,
				stockDataDate,
				setStockDataDate,
				eventsData,
				setEventsData,
				eventsDevices,
				setEventsDevices,
				eventsDataDate,
				setEventsDataDate,
				globalAssignments,
				setGlobalAssignments,
				globalDevices,
				setGlobalDevices,
				globalDataDate,
				setGlobalDataDate,
			}}
		>
			{children}
		</DataContext.Provider>
	);
}

export function useData() {
	const context = useContext(DataContext);
	if (context === undefined) {
		throw new Error("useData must be used within a DataProvider");
	}
	return context;
}
