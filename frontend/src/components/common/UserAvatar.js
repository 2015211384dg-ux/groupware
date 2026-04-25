import React from 'react';

const GRADIENT_PAIRS = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a18cd1', '#fbc2eb'],
    ['#ffecd2', '#fcb69f'],
    ['#ff9a9e', '#fecfef'],
    ['#a1c4fd', '#c2e9fb'],
    ['#fd7043', '#ff8a65'],
    ['#26c6da', '#00acc1'],
    ['#66bb6a', '#43a047'],
];

function hashName(name = '') {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}

function UserAvatar({ name, profileImage, size = 36, style = {} }) {
    if (profileImage) {
        return (
            <div style={{
                width: size,
                height: size,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                ...style
            }}>
                <img
                    src={`/${profileImage}`}
                    alt={name}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scale(1.15)',
                        display: 'block',
                    }}
                />
            </div>
        );
    }


    const idx = hashName(name) % GRADIENT_PAIRS.length;
    const [from, to] = GRADIENT_PAIRS[idx];
    const fontSize = Math.round(size * 0.42);

    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize,
            flexShrink: 0,
            userSelect: 'none',
            ...style
        }}>
            {name?.charAt(0) || 'U'}
        </div>
    );
}

export default UserAvatar;
