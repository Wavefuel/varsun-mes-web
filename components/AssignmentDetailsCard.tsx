import React from 'react';
import CustomDatePicker from '@/components/CustomDatePicker';

export interface AssignmentFormData {
    machine: string;
    operator: string;
    date: string;
    shift: string;
    startTime: string;
    endTime: string;
    code: string;
    partNumber: string;
    workOrderId: string;
    opNumber: number;
    batch: number;
    estTime: string;
    estUnit: string;
}

interface AssignmentDetailsCardProps {
    title: string;
    icon: string;
    data: AssignmentFormData;
    onChange: (field: keyof AssignmentFormData, value: any) => void;
    errors?: Record<string, boolean>;
    readOnly?: boolean;
    isEditMode?: boolean;
    hideHeader?: boolean;
}

export default function AssignmentDetailsCard({
    title,
    icon,
    data,
    onChange,
    errors = {},
    readOnly = false,
    isEditMode = false,
    hideHeader = false
}: AssignmentDetailsCardProps) {

    // Helper to handle input changes
    const handleChange = (field: keyof AssignmentFormData, value: any) => {
        if (!readOnly) {
            onChange(field, value);
        }
    };

    return (
        <section className={`bg-white !rounded-xl border border-gray-100 shadow-sm overflow-hidden ${hideHeader ? '!border-t-0 !rounded-t-none' : ''}`}>
            {!hideHeader && (
                <div className="bg-gray-50 !px-4 !py-2 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-primary">
                        {title}
                    </h3>
                    <span className={`material-symbols-outlined text-gray-400 !text-2xl`}>
                        {icon}
                    </span>
                </div>
            )}

            <div className="!p-4 !space-y-4">
                {/* Dropdowns Pair (Machine & Operator) */}
                <div className="grid grid-cols-2 !gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Machine</label>
                        <div className="relative">
                            <select
                                value={data.machine}
                                onChange={(e) => handleChange('machine', e.target.value)}
                                disabled={readOnly}
                                className={`w-full bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 !text-xs appearance-none focus:ring-primary focus:border-primary ${readOnly ? 'cursor-not-allowed text-gray-500' : ''}`}
                            >
                                <option>CNC-042 (Alpha)</option>
                                <option>LATH-09 (Beta)</option>
                                <option>MILL-12 (Gamma)</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none !text-xl">expand_more</span>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">Operator</label>
                        <div className="relative">
                            <select
                                value={data.operator}
                                onChange={(e) => handleChange('operator', e.target.value)}
                                disabled={readOnly}
                                className={`w-full bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 !text-xs appearance-none focus:ring-primary focus:border-primary ${readOnly ? 'cursor-not-allowed text-gray-500' : ''}`}
                            >
                                <option>Marcus Jensen</option>
                                <option>Sarah Chen</option>
                                <option>David Miller</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none !text-xl">expand_more</span>
                        </div>
                    </div>
                </div>

                {/* Date and Shift Selection */}
                <div className="grid grid-cols-2 !gap-3">
                    <div className="!space-y-1.5">
                        <label className="!text-[11px] font-bold text-gray-500 uppercase ml-1">Shift Date</label>
                        <div className="relative w-full">
                            {readOnly ? (
                                <div className="w-full relative bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 text-left">
                                    <span className="!text-xs font-medium block pr-8 text-gray-500">
                                        {data.date ? new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select Date'}
                                    </span>
                                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 !text-gray-400 !text-xl pointer-events-none">calendar_today</span>
                                </div>
                            ) : (
                                <CustomDatePicker
                                    value={data.date}
                                    onChange={(date) => handleChange('date', date)}
                                    customInput={
                                        <button className="w-full relative bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 text-left transition-all">
                                            <span className="!text-xs font-medium block pr-8">{data.date ? new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select Date'}</span>
                                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 !text-gray-400 !text-xl pointer-events-none">calendar_today</span>
                                        </button>
                                    }
                                />
                            )}
                        </div>
                    </div>
                    <div className="!space-y-1.5">
                        <label className="!text-[11px] font-bold text-gray-500 uppercase ml-1">Shift Work</label>
                        <div className="relative">
                            <select
                                value={data.shift}
                                onChange={(e) => handleChange('shift', e.target.value)}
                                disabled={readOnly}
                                className={`w-full bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 !text-xs appearance-none focus:ring-primary focus:border-primary ${readOnly ? 'cursor-not-allowed text-gray-500' : ''}`}
                            >
                                <option>Day Shift (S1)</option>
                                <option>Night Shift (S2)</option>
                                <option>Custom</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none !text-xl">expand_more</span>
                        </div>
                    </div>
                </div>

                {/* Visual Logic Badges (Code/Start/End) */}
                <div className={`flex !gap-2 bg-primary/5 !p-3 rounded-lg border transition-colors ${errors.shift ? 'border-red-500 bg-red-50' : 'border-primary/10'}`}>
                    <div className="flex-1 flex flex-col justify-center">
                        <p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">Code</p>
                        <input
                            type="text"
                            value={data.code}
                            onChange={(e) => handleChange('code', e.target.value)}
                            disabled={readOnly}
                            className={`w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 placeholder-primary/50 leading-none h-auto ${readOnly ? 'cursor-not-allowed' : ''}`}
                        />
                    </div>
                    <div className="w-px bg-primary/20"></div>
                    <div className="flex-1 flex flex-col justify-center">
                        <p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">Start</p>
                        <input
                            type="time"
                            value={data.startTime}
                            onChange={(e) => handleChange('startTime', e.target.value)}
                            disabled={readOnly}
                            className={`w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto ${readOnly ? 'cursor-not-allowed' : ''}`}
                        />
                    </div>
                    <div className="w-px bg-primary/20"></div>
                    <div className="flex-1 flex flex-col justify-center">
                        <p className="!text-[9px] font-bold text-primary/60 uppercase leading-none mb-[2px]">End</p>
                        <input
                            type="time"
                            value={data.endTime}
                            onChange={(e) => handleChange('endTime', e.target.value)}
                            disabled={readOnly}
                            className={`w-full bg-transparent border-none p-0 text-xs font-bold text-primary focus:ring-0 leading-none h-auto ${readOnly ? 'cursor-not-allowed' : ''}`}
                        />
                    </div>
                </div>

                {/* Production Details */}
                <div className="!space-y-3 pt-2">
                    {/* Part # & WO # */}
                    <div className="grid grid-cols-2 !gap-3">
                        <div className="!space-y-1.5">
                            <label className="!text-[11px] font-bold text-gray-500 uppercase ml-1">Part Number</label>
                            <input
                                type="text"
                                value={data.partNumber}
                                onChange={(e) => handleChange('partNumber', e.target.value)}
                                disabled={readOnly}
                                className={`w-full bg-gray-50 border !rounded-lg !py-3 !px-3 !text-xs font-mono focus:ring-primary focus:border-primary ${errors.partNumber ? 'border-red-500' : 'border-gray-200'} ${readOnly ? 'cursor-not-allowed text-gray-500' : ''}`}
                                placeholder="P-90882-X"
                            />
                        </div>
                        <div className="!space-y-1.5">
                            <label className="!text-[11px] font-bold text-gray-500 uppercase ml-1">Work Order</label>
                            <input
                                type="text"
                                value={data.workOrderId}
                                onChange={(e) => handleChange('workOrderId', e.target.value)}
                                disabled={readOnly || isEditMode}
                                className={`w-full border !rounded-lg !py-3 !px-3 !text-xs font-mono focus:ring-primary focus:border-primary ${isEditMode || readOnly
                                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
                                    : `bg-gray-50 ${errors.workOrderId ? 'border-red-500' : 'border-gray-200'}`
                                    }`}
                                placeholder="WO-55612"
                            />
                        </div>
                    </div>

                    {/* Op / Batch / Est */}
                    <div className="grid grid-cols-3 !gap-2">
                        <div className="!space-y-1.5">
                            <label className="!text-[11px] font-bold text-gray-500 uppercase ml-1">Op #</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={data.opNumber}
                                    onChange={(e) => handleChange('opNumber', Number(e.target.value))}
                                    disabled={readOnly}
                                    className={`w-full bg-gray-50 border border-gray-200 !rounded-lg !py-3 !px-3 !text-xs focus:ring-primary focus:border-primary ${readOnly ? 'cursor-not-allowed text-gray-500' : ''}`}
                                />
                            </div>
                        </div>
                        <div className="!space-y-1.5">
                            <label className="!text-[11px] font-bold text-gray-500 uppercase ml-1">Batch Qty</label>
                            <input
                                type="number"
                                value={data.batch}
                                onChange={(e) => handleChange('batch', Number(e.target.value))}
                                disabled={readOnly}
                                className={`w-full bg-gray-50 border !rounded-lg !py-3 !px-3 !text-xs focus:ring-primary focus:border-primary transition-colors ${errors.capacity ? 'border-red-500 bg-red-50' : 'border-gray-200'} ${readOnly ? 'cursor-not-allowed text-gray-500' : ''}`}
                            />
                        </div>
                        <div className="!space-y-1.5">
                            <label className="!text-[11px] font-bold text-gray-500 uppercase ml-1">Est/Part</label>
                            <div className={`flex bg-gray-50 border !rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-colors ${errors.capacity ? 'border-red-500 bg-red-50' : 'border-gray-200'} ${readOnly ? 'opacity-70' : ''}`}>
                                <input
                                    type="text"
                                    value={data.estTime}
                                    onChange={(e) => handleChange('estTime', e.target.value)}
                                    disabled={readOnly}
                                    className={`w-full bg-transparent border-none !py-3 !px-3 !text-xs text-center focus:ring-0 ${readOnly ? 'cursor-not-allowed' : ''}`}
                                    placeholder="1.5"
                                />
                                <div className="w-px bg-gray-200"></div>
                                <div className="relative w-16 bg-gray-100">
                                    <select
                                        value={data.estUnit}
                                        onChange={(e) => handleChange('estUnit', e.target.value)}
                                        disabled={readOnly}
                                        className={`w-full h-full bg-transparent border-none !py-0 !pl-1 !pr-4 !text-xs font-bold focus:ring-0 appearance-none text-center ${readOnly ? 'cursor-not-allowed' : ''}`}
                                    >
                                        <option value="min">m</option>
                                        <option value="hr">h</option>
                                    </select>
                                    <span className="hidden"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
