import React from "react";

interface LabelProps {
	children: React.ReactNode;
	className?: string;
}

export function AssignmentLabel({ children, className = "" }: LabelProps) {
	return <label className={`block text-[11px] font-bold text-gray-500 uppercase ml-1 ${className}`}>{children}</label>;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
	containerClassName?: string;
}

export function AssignmentSelect({ className = "", containerClassName = "", children, disabled, ...props }: SelectProps) {
	return (
		<div className={`relative ${containerClassName}`}>
			<select
				disabled={disabled}
				className={`w-full bg-gray-50 border border-gray-200 !rounded-lg !py-3 !pl-3 !pr-10 !text-xs appearance-none focus:ring-primary focus:border-primary truncate ${disabled ? "cursor-not-allowed text-gray-500" : ""
					} ${className}`}
				{...props}
			>
				{children}
			</select>
			<span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none !text-xl">
				expand_more
			</span>
		</div>
	);
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	hasError?: boolean;
}

export function AssignmentInput({ className = "", disabled, hasError = false, ...props }: InputProps) {
	return (
		<input
			disabled={disabled}
			className={`w-full bg-gray-50 border !rounded-lg !py-3 !px-3 !text-xs focus:ring-primary focus:border-primary transiton-colors ${hasError ? "border-red-500 bg-red-50" : "border-gray-200"
				} ${disabled ? "cursor-not-allowed text-gray-500" : ""} ${className}`}
			{...props}
		/>
	);
}

interface WrapperProps {
	label: string;
	children: React.ReactNode;
	className?: string;
}

export function AssignmentField({ label, children, className = "" }: WrapperProps) {
	return (
		<div className={`space-y-1.5 ${className}`}>
			<AssignmentLabel>{label}</AssignmentLabel>
			{children}
		</div>
	);
}
