const FIXED_COLORS = {
    '공지': { background: '#ede9fe', color: '#7c3aed' },
    '일반': { background: '#ffedd5', color: '#c2410c' },
};

const CATEGORY_COLORS = [
    { background: '#dbeafe', color: '#1d4ed8' },
    { background: '#dcfce7', color: '#15803d' },
    { background: '#fef9c3', color: '#a16207' },
    { background: '#fee2e2', color: '#b91c1c' },
    { background: '#e0f2fe', color: '#0369a1' },
    { background: '#fce7f3', color: '#be185d' },
    { background: '#ecfdf5', color: '#065f46' },
    { background: '#f5f3ff', color: '#6d28d9' },
    { background: '#fdf2f8', color: '#9d174d' },
    { background: '#fffbeb', color: '#92400e' },
];

export function getCategoryColor(label) {
    if (!label) return FIXED_COLORS['일반'];
    if (FIXED_COLORS[label]) return FIXED_COLORS[label];
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
        hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}
