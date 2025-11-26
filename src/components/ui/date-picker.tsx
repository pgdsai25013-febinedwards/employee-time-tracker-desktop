import React from "react";
import { Input } from "./input";

interface DatePickerProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
}

export function DatePicker({ value, onChange, placeholder, className }: DatePickerProps) {
    return (
        <Input
            type="date"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={className}
        />
    );
}
