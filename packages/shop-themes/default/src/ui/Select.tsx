import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
    value: string;
    label: string;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    className?: string;
    placeholder?: string;
}

export function CustomSelect({ value, onChange, options, className, placeholder }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'w-full flex items-center justify-between px-6 h-12',
                    'bg-gray-50 border border-gray-100 rounded-2xl',
                    'text-sm font-bold text-gray-700',
                    'focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white',
                    'transition-all duration-200 cursor-pointer outline-none',
                    isOpen && 'border-blue-500 bg-white ring-2 ring-blue-500/10'
                )}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown className={cn(
                    "h-4 w-4 text-gray-400 transition-transform duration-200",
                    isOpen && "rotate-180 text-blue-500"
                )} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        style={{ originY: 0 }}
                        className="absolute z-[60] left-0 right-0 min-w-full bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden p-2"
                    >
                        <div className="max-h-60 overflow-y-auto scrollbar-hide">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors text-left",
                                        value === option.value
                                            ? "bg-blue-50 text-blue-600"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    )}
                                >
                                    <span className="truncate mr-2">{option.label}</span>
                                    {value === option.value && <Check className="h-4 w-4 flex-shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
