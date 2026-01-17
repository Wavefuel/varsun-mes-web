"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Order, MOCK_INITIAL_ORDERS } from '@/lib/types';

interface DataContextType {
    orders: Order[];
    addOrder: (order: Order) => void;
    updateOrder: (id: string, updates: Partial<Order>) => void;
    getOrderById: (id: string) => Order | undefined;
    deleteOrder: (id: string) => void;
    currentDate: string;
    setCurrentDate: (date: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        // Load from local storage or use mock
        const saved = localStorage.getItem('mes_orders');
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
            localStorage.setItem('mes_orders', JSON.stringify(orders));
        }
    }, [orders]);

    const addOrder = (order: Order) => {
        setOrders(prev => [order, ...prev]);
    };

    const updateOrder = (id: string, updates: Partial<Order>) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    };

    const getOrderById = (id: string) => orders.find(o => o.id === id);

    const deleteOrder = (id: string) => {
        setOrders(prev => prev.filter(o => o.id !== id));
    };

    return (
        <DataContext.Provider value={{ orders, addOrder, updateOrder, getOrderById, deleteOrder, currentDate, setCurrentDate }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
