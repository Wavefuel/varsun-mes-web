"use client";

import React from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { useData } from '@/context/DataContext';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MetricValue, MetricLabel, SectionTitle } from '@/components/ui/Typography';

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
        showDateNavigator={true}
      />



      <main className="px-4 pb-4 space-y-6 pt-[16px]">

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
              <Badge variant="success" className="px-1 py-0">+2%</Badge>
            </div>
            <MetricValue>94.2%</MetricValue>
            <MetricLabel>Plant Efficiency</MetricLabel>
          </Card>
          <Card className="p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="material-symbols-outlined text-primary !text-xl !leading-none py-0.5">precision_manufacturing</span>
            </div>
            <MetricValue>{activeMachines}/10</MetricValue>
            <MetricLabel>Machines Active</MetricLabel>
          </Card>
          <Card className="p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="material-symbols-outlined text-orange-500 !text-xl !leading-none py-0.5">trending_up</span>
            </div>
            <MetricValue>{displayProjected}</MetricValue>
            <MetricLabel>Projected Output</MetricLabel>
          </Card>
        </section>

        {/* Active Production List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <SectionTitle>Active Production</SectionTitle>
            <Link href="/planning" className="text-2xs font-bold text-gray-400 hover:text-primary transition-colors">VIEW ALL</Link>
          </div>

          <div className="space-y-3">
            {activeOrders.slice(0, 3).map(order => (
              <Card key={order.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-bold font-display text-primary">{order.id}</p>
                    <p className="text-xs-plus text-gray-500 font-medium mt-0.5">{order.machine} • {order.operator}</p>
                  </div>
                  <Badge>{order.partNumber}</Badge>
                </div>
                {/* Simulated Progress Bar since we don't have real live data yet */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs-plus">
                    <span className="font-bold text-gray-500">Progress</span>
                    <span className="font-bold text-primary">0%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </Card>
            ))}
            {activeOrders.length === 0 && (
              <div className="text-center py-6 text-gray-400 text-xs font-bold">No active orders</div>
            )}
          </div>
        </section>

        {/* Completed Work Orders */}
        <section className="space-y-3 pb-4">
          <div className="flex items-center justify-between px-1">
            <SectionTitle>Completed Today</SectionTitle>
          </div>

          <Card className="overflow-hidden">
            <div className="divide-y divide-gray-100">
              {completedOrders.slice(0, 5).map(order => (
                <div key={order.id} className="p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary truncate">{order.id}</p>
                    <p className="text-2xs text-gray-500 uppercase font-bold tracking-tight">{order.partNumber}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs-plus font-bold text-primary">{order.actualOutput} / {order.target}</p>
                    <Link href={`/stock/${encodeURIComponent(order.id)}`} className="text-2xs font-bold text-primary/70 underline uppercase">Details</Link>
                  </div>
                </div>
              ))}
              {completedOrders.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-xs font-bold">No completed orders yet</div>
              )}
            </div>
          </Card>
        </section>

      </main>

    </div >
  );
}
