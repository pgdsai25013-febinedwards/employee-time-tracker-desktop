import React from 'react';
import { Badge } from './ui/badge';
import { getCategoryColor, getCategoryLabel } from '../types/category';

interface CategoryBadgeProps {
    categoryName?: string;
    className?: string;
    size?: 'sm' | 'default';
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ categoryName, className = '', size = 'default' }) => {
    if (!categoryName) return null;

    const colorClass = getCategoryColor(categoryName);
    const label = getCategoryLabel(categoryName);
    const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0 h-5' : 'text-xs px-2 py-0.5';

    return (
        <Badge
            variant="outline"
            className={`${colorClass} ${sizeClass} border ${className} whitespace-nowrap`}
        >
            {label}
        </Badge>
    );
};
