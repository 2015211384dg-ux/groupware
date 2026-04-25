const FIXED_COLORS = {
    '공지': { background: '#ede9fe', color: '#7c3aed' },
    '일반': { background: '#f1f5f9', color: '#64748b' },
    '업무': { background: '#dbeafe', color: '#2563eb' },
};

const CATEGORY_COLORS = [
    { background: '#dbeafe', color: '#2563eb' },
    { background: '#dcfce7', color: '#16a34a' },
    { background: '#fef9c3', color: '#ca8a04' },
    { background: '#ffe4e6', color: '#e11d48' },
    { background: '#e0f2fe', color: '#0284c7' },
    { background: '#fce7f3', color: '#db2777' },
    { background: '#f0fdf4', color: '#15803d' },
    { background: '#f5f3ff', color: '#7c3aed' },
    { background: '#fff7ed', color: '#c2410c' },
    { background: '#f1f5f9', color: '#475569' },
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
