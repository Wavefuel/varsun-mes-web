"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TagInputProps {
	value: string[];
	onChange: (value: string[]) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	hasError?: boolean;
}

export default function TagInput({ value = [], onChange, placeholder, disabled, className, hasError }: TagInputProps) {
	const [inputValue, setInputValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === "," || e.key === " ") {
			e.preventDefault();
			addTag();
		} else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
			removeTag(value.length - 1);
		}
	};

	const addTag = () => {
		const trimmed = inputValue.trim();
		if (trimmed && !value.includes(trimmed)) {
			onChange([...value, trimmed]);
			setInputValue("");
		} else if (trimmed === "") {
			setInputValue("");
		}
	};

	const removeTag = (index: number) => {
		const newValue = [...value];
		newValue.splice(index, 1);
		onChange(newValue);
	};

	return (
		<div className={cn("w-full", className)}>
			<div className="relative flex gap-2">
				<input
					ref={inputRef}
					type="text"
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={handleKeyDown}
					// Removed onBlur={addTag} to prevent accidental adds when clicking elsewhere
					placeholder={placeholder}
					disabled={disabled}
					className={cn(
						"flex-1 bg-gray-50 border border-gray-200 rounded-lg py-3 px-3 text-xs text-gray-800 focus:ring-0 focus:border-gray-200 transition-all placeholder:text-gray-400 font-normal outline-none",
						hasError && "border-red-500 bg-red-50",
						disabled && "opacity-60 cursor-not-allowed bg-gray-100",
					)}
				/>
				<button
					type="button"
					onClick={addTag}
					disabled={!inputValue.trim() || disabled}
					className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 font-bold text-xs px-3 rounded-lg shadow-sm transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
				>
					ADD
				</button>
			</div>

			{value.length > 0 && (
				<div className="flex flex-wrap gap-2 mt-2">
					{value.map((tag, index) => (
						<span
							key={index}
							className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-[11px] font-bold text-gray-600 shadow-sm"
						>
							{tag}
							{!disabled && (
								<button
									type="button"
									onClick={() => removeTag(index)}
									className="hover:text-red-500 flex items-center text-gray-400 transition-colors"
								>
									<span className="material-symbols-outlined !text-[14px]">close</span>
								</button>
							)}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
