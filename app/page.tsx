"use client";

import React from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import CustomDatePicker from '@/components/CustomDatePicker';
import DateNavigator from '@/components/DateNavigator';
import { useData } from '@/context/DataContext';

export default function Home() {
  const { orders, currentDate, setCurrentDate } = useData();

  // Metrics Logic
  // Filter all orders by the global currentDate
  const todaysOrders = orders.filter(o => o.date === currentDate);

  const activeOrders = todaysOrders.filter(o => o.status === 'PLANNED' || o.status === 'ACTIVE');
  const completedOrders = todaysOrders.filter(o => o.status === 'COMPLETED');

  const activeCount = activeOrders.length;

  // Projected Output: Sum of targets of active orders
  const projectedOutput = activeOrders.reduce((sum, order) => sum + (order.target || 0), 0);

  // Format huge numbers
  const displayProjected = projectedOutput > 1000
    ? (projectedOutput / 1000).toFixed(1) + 'k'
    : projectedOutput;

  // Active Machines: Unique machines in active orders
  const activeMachines = new Set(activeOrders.map(o => o.machine)).size;

  return (
    <div className="flex flex-col min-h-screen bg-background-dashboard">

      <AppHeader
        title="Production Overview"
        subtitle="Live Plant Metrics"
      />

      {/* Persistent Date Navigator for Home Page */}
      <div className="sticky top-[68px] z-20 bg-background-dashboard px-4 pb-2 pt-1">
        <DateNavigator
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
        />
      </div>

      <main className="px-4 pb-4 space-y-4">

        {/* KPI Grid */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-xl border border-card-border card-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="material-symbols-outlined text-primary text-xl">assignment</span>
            </div>
            <p className="text-[22px] font-bold font-display text-primary leading-none">{activeCount}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 leading-tight">Active Work Orders</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-card-border card-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="material-symbols-outlined text-green-600 text-xl">bolt</span>
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1 rounded">+2%</span>
            </div>
            <p className="text-[22px] font-bold font-display text-primary leading-none">94.2%</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 leading-tight">Plant Efficiency</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-card-border card-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="material-symbols-outlined text-primary text-xl">precision_manufacturing</span>
            </div>
            <p className="text-[22px] font-bold font-display text-primary leading-none">{activeMachines}/10</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 leading-tight">Machines Active</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-card-border card-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="material-symbols-outlined text-orange-500 text-xl">trending_up</span>
            </div>
            <p className="text-[22px] font-bold font-display text-primary leading-none">{displayProjected}</p>
            <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 leading-tight">Projected Output</p>
          </div>
        </section>

        {/* Active Production List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-xs uppercase tracking-widest text-primary">Active Production</h3>
            <Link href="/planning" className="text-[10px] font-bold text-gray-400 hover:text-primary transition-colors">VIEW ALL</Link>
          </div>

          <div className="space-y-3">
            {activeOrders.slice(0, 3).map(order => (
              <div key={order.id} className="bg-white border border-card-border rounded-xl p-4 card-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-bold font-display text-primary">{order.id}</p>
                    <p className="text-[11px] text-gray-500 font-medium mt-0.5">{order.machine} • {order.operator}</p>
                  </div>
                  <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded uppercase">{order.partNumber}</span>
                </div>
                {/* Simulated Progress Bar since we don't have real live data yet */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-gray-500">Progress</span>
                    <span className="font-bold text-primary">0%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>
            ))}
            {activeOrders.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs font-bold">No active orders</div>
            )}
          </div>
        </section>

        {/* Completed Work Orders */}
        <section className="space-y-3 pb-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-xs uppercase tracking-widest text-primary">Completed Today</h3>
          </div>

          <div className="bg-white border border-card-border rounded-xl overflow-hidden card-shadow">
            <div className="divide-y divide-gray-100">
              {completedOrders.slice(0, 5).map(order => (
                <div key={order.id} className="p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary truncate">{order.id}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{order.partNumber}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-bold text-primary">{order.actualOutput} / {order.target}</p>
                    <Link href={`/stock/${encodeURIComponent(order.id)}`} className="text-[10px] font-bold text-primary/70 underline uppercase">Details</Link>
                  </div>
                </div>
              ))}
              {completedOrders.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-xs font-bold">No completed orders yet</div>
              )}
            </div>
          </div>
        </section>

      </main>

    </div >
  );
}
