import React, { useState, useEffect, useRef } from 'react';
import './LazyImage.css';

/**
 * Lazy Loading 이미지 컴포넌트
 * Intersection Observer API 사용
 */
function LazyImage({ 
    src, 
    alt = '', 
    thumbnail = null,
    className = '',
    width,
    height,
    onClick 
}) {
    const [imageSrc, setImageSrc] = useState(thumbnail || '/placeholder.png');
    const [imageLoaded, setImageLoaded] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        let observer;
        
        if (imgRef.current) {
            observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            // 뷰포트에 들어오면 실제 이미지 로드
                            setImageSrc(src);
                            observer.unobserve(entry.target);
                        }
                    });
                },
                {
                    rootMargin: '50px' // 50px 전에 미리 로드
                }
            );

            observer.observe(imgRef.current);
        }

        return () => {
            if (observer && imgRef.current) {
                observer.unobserve(imgRef.current);
            }
        };
    }, [src]);

    const handleLoad = () => {
        setImageLoaded(true);
    };

    return (
        <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            className={`lazy-image ${imageLoaded ? 'loaded' : 'loading'} ${className}`}
            width={width}
            height={height}
            onLoad={handleLoad}
            onClick={onClick}
            loading="lazy" // 네이티브 lazy loading도 활용
        />
    );
}

export default LazyImage;
