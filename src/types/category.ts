export type CategoryName = 'core' | 'non-core' | 'unproductive';

export interface Category {
    id: number;
    name: CategoryName;
    description?: string;
}

export const getCategoryColor = (name?: string) => {
    switch (name?.toLowerCase()) {
        case 'core':
            return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'non-core':
            return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'unproductive':
            return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        default:
            return 'bg-slate-800 text-slate-400 border-slate-700';
    }
};

export const getCategoryLabel = (name?: string) => {
    switch (name?.toLowerCase()) {
        case 'core':
            return 'Core';
        case 'non-core':
            return 'Non-Core';
        case 'unproductive':
            return 'Unproductive';
        default:
            return name || 'Unknown';
    }
};
