import { useState, useEffect } from 'react';

/**
 * Debounce Hook
 * 입력이 멈춘 후 일정 시간 뒤에 값을 업데이트
 * 
 * @param {any} value - 디바운스할 값
 * @param {number} delay - 지연 시간 (ms)
 * @returns {any} 디바운스된 값
 */
export function useDebounce(value, delay = 500) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Throttle Hook
 * 일정 시간 간격으로만 값을 업데이트
 * 
 * @param {any} value - 쓰로틀할 값
 * @param {number} interval - 간격 (ms)
 * @returns {any} 쓰로틀된 값
 */
export function useThrottle(value, interval = 500) {
    const [throttledValue, setThrottledValue] = useState(value);
    const lastRan = useState(Date.now());

    useEffect(() => {
        const handler = setTimeout(() => {
            if (Date.now() - lastRan[0] >= interval) {
                setThrottledValue(value);
                lastRan[0] = Date.now();
            }
        }, interval - (Date.now() - lastRan[0]));

        return () => {
            clearTimeout(handler);
        };
    }, [value, interval]);

    return throttledValue;
}
