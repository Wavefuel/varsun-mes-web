"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { CustomToast } from '@/components/CustomToast';
import AssignmentDetailsCard, { AssignmentFormData } from '@/components/AssignmentDetailsCard';

function AssignmentForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('id');
    const isEditMode = !!orderId;

    const { addOrder, updateOrder, getOrderById, currentDate, setCurrentDate, orders } = useData();

    // Consolidated Form Date State
    const [formData, setFormData] = useState<AssignmentFormData>({
        machine: "CNC-042 (Alpha)",
        operator: "Marcus Jensen",
        date: currentDate,
        shift: "Day (S1)",
        startTime: "06:00",
        endTime: "14:00",
        code: "SH-D24",
        partNumber: "",
        workOrderId: "",
        opNumber: 20,
        batch: 450,
        estTime: "1.5",
        estUnit: "min"
    });

    const [errors, setErrors] = useState<Record<string, boolean>>({});

    // Load data for edit mode
    useEffect(() => {
        if (isEditMode && orderId) {
            const order = getOrderById(orderId);
            if (order) {
                let estTime = "1.5";
                let estUnit = "min";

                // Parse estPart which is typically "1.5m" or "2h"
                const est = order.estPart || "1.5m";
                if (est.endsWith('h')) {
                    estTime = est.replace('h', '');
                    estUnit = 'hr';
                } else {
                    estTime = est.replace('m', '');
                    estUnit = 'min';
                }

                setFormData({
                    machine: order.machine,
                    operator: order.operator,
                    date: order.date,
                    shift: order.shift,
                    startTime: order.startTime,
                    endTime: order.endTime,
                    code: order.code || "SH-D24",
                    partNumber: order.partNumber,
                    workOrderId: order.id,
                    opNumber: order.opNumber || 20,
                    batch: order.batch || 450,
                    estTime,
                    estUnit
                });
            } else {
                toast.error("Order not found");
                router.push('/planning');
            }
        } else if (!isEditMode) {
            // Reset to defaults or globals for create mode if needed
            if (formData.date !== currentDate) {
                setFormData(prev => ({ ...prev, date: currentDate }));
            }
        }
    }, [isEditMode, orderId, getOrderById, router, currentDate]);

    // Helper to update specific fields
    const handleFieldChange = (field: keyof AssignmentFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear specific errors on change
        if (field === 'partNumber' && errors.partNumber) setErrors(prev => { const n = { ...prev }; delete n.partNumber; return n; });
        if (field === 'workOrderId' && errors.workOrderId) setErrors(prev => { const n = { ...prev }; delete n.workOrderId; return n; });
        if ((field === 'startTime' || field === 'endTime') && errors.shift) setErrors(prev => { const n = { ...prev }; delete n.shift; delete n.capacity; return n; });
        if ((field === 'batch' || field === 'estTime') && errors.capacity) setErrors(prev => { const n = { ...prev }; delete n.capacity; return n; });
    };

    const handleSave = () => {
        const newErrors: Record<string, boolean> = {};
        if (!formData.partNumber) newErrors.partNumber = true;
        if (!formData.workOrderId) newErrors.workOrderId = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.custom((t) => (
                <CustomToast
                    t={t}
                    title="Validation Error"
                    message="Please complete all required fields to proceed."
                />
            ));
            return;
        }

        // Capacity Validation
        const getMinutesFromTime = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const startMin = getMinutesFromTime(formData.startTime);
        let endMin = getMinutesFromTime(formData.endTime);
        // Handle overnight shift (e.g., 22:00 to 06:00)
        if (endMin < startMin) {
            endMin += 24 * 60;
        }

        const shiftDurationMinutes = endMin - startMin;

        let estPerPartMinutes = parseFloat(formData.estTime);
        if (formData.estUnit === 'hr') {
            estPerPartMinutes *= 60;
        }

        const totalRequiredMinutes = formData.batch * estPerPartMinutes;

        if (totalRequiredMinutes > shiftDurationMinutes) {
            const reqHrs = Math.floor(totalRequiredMinutes / 60);
            const reqMins = Math.round(totalRequiredMinutes % 60);

            const shiftHrs = Math.floor(shiftDurationMinutes / 60);
            const shiftMins = Math.round(shiftDurationMinutes % 60);

            setErrors(prev => ({ ...prev, capacity: true, shift: true }));

            toast.custom((t) => (
                <CustomToast
                    t={t}
                    title="Capacity Limit Exceeded"
                    message={
                        <span>
                            Required time <span className="font-bold">{reqHrs}h {reqMins}m</span> exceeds shift duration <span className="font-bold">{shiftHrs}h {shiftMins}m</span>.
                        </span>
                    }
                    actions="Try reducing Batch Qty/Est. Part or extending Shift."
                />
            ), { duration: 10000 });
            return;
        }

        // Clear capacity error if validation passes - logic already mostly simplified by re-render, but explicit clear is safe
        if (errors.capacity || errors.shift) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.capacity;
                delete newErrors.shift;
                return newErrors;
            });
        }

        const orderData = {
            partNumber: formData.partNumber,
            machine: formData.machine,
            operator: formData.operator,
            date: formData.date,
            shift: formData.shift,
            startTime: formData.startTime,
            endTime: formData.endTime,
            code: formData.code,
            opNumber: formData.opNumber,
            batch: formData.batch,
            estPart: `${formData.estTime}${formData.estUnit === 'min' ? 'm' : 'h'}`,
            target: formData.batch,
        };

        if (isEditMode && orderId) {
            updateOrder(orderId, orderData);
            toast.success("Assignment updated");
        } else {
            addOrder({
                id: formData.workOrderId,
                ...orderData,
                status: 'PLANNED'
            });
            // Update the global date to match the new assignment
            if (formData.date !== currentDate) {
                setCurrentDate(formData.date);
            }
        }

        router.push('/planning');
    };

    return (
        <div className="flex flex-col min-h-screen bg-background-dashboard font-display">

            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-[var(--header-height)] px-4 py-2">
                <div className="flex items-center justify-between h-full">
                    <div className="flex flex-col">
                        <h2 className="header-title">{isEditMode ? 'Edit Assignment' : 'Shift Assignment'}</h2>
                        <p className="header-subtitle mt-0.5 uppercase block">Planning</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="text-gray-500 font-bold text-xs uppercase hover:text-gray-700 active:scale-95 transition-transform"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm active:scale-95 transition-transform"
                        >
                            SAVE
                        </button>
                    </div>
                </div>
            </header>

            <main className="!p-4 !space-y-6 !pb-24">

                {/* Reusable Assignment Card Component */}
                <AssignmentDetailsCard
                    title={isEditMode ? 'Assignment Details' : 'New Assignment'}
                    icon={isEditMode ? 'edit_note' : 'precision_manufacturing'}
                    data={formData}
                    onChange={handleFieldChange}
                    errors={errors}
                    isEditMode={isEditMode}
                    readOnly={false} // Always editable in Planning page
                />

                {/* Section: Queue / Planned Assignments (Dynamic) - Hide in Edit Mode */}
                {!isEditMode && (
                    <section className="!space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="font-bold text-sm uppercase tracking-wider text-gray-600">Planned Queue <span className="text-gray-400 normal-case tracking-normal">({formData.machine.split(' ')[0]})</span></h3>
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {orders.filter(o => o.machine === formData.machine && o.date === formData.date && o.status !== 'COMPLETED').length} Tasks
                            </span>
                        </div>
                        {/* Filtered Queue List */}
                        <div className="!space-y-2">
                            {orders.filter(o => o.machine === formData.machine && o.date === formData.date && o.status !== 'COMPLETED')
                                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                .map((order) => (
                                    <div key={order.id} className="bg-white border border-gray-100 !p-3 rounded-lg flex items-center !gap-3">
                                        <div className="size-10 bg-gray-100 rounded flex items-center justify-center shrink-0 text-gray-400">
                                            <span className={`material-symbols-outlined !text-xl ${order.status === 'ACTIVE' ? '!text-primary' : '!text-gray-400'}`}>
                                                {order.status === 'ACTIVE' ? 'play_circle' :
                                                    order.status === 'PLANNED' ? 'pending' : 'check_circle'}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <p className="font-bold text-sm truncate">{order.id} • {order.partNumber}</p>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${order.status === 'ACTIVE' ? 'text-green-600 bg-green-50' :
                                                    order.status === 'COMPLETED' ? 'text-blue-600 bg-blue-50' :
                                                        'text-gray-400 bg-gray-50'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 font-medium">
                                                Op {order.opNumber} • {order.operator.split(' ')[0]} • {order.shift}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                            {orders.filter(o => o.machine === formData.machine && o.date === formData.date && o.status !== 'COMPLETED').length === 0 && (
                                <div className="text-center py-6 text-gray-400 text-xs italic bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
                                    No active queue for {formData.machine.split(' ')[0]} on this date.
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

export default function CreateAssignmentPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AssignmentForm />
        </Suspense>
    );
}
