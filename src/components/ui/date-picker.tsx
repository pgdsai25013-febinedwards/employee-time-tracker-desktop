import React from "react";
import { Input } from "./input";

interface DatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function DatePicker({ value, onChange, placeholder }: DatePickerProps) {
    return (
        <Input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
        />
    );
}
