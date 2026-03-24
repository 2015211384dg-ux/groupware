/**
 * 간단한 메모리 기반 캐시 시스템
 * 프로덕션에서는 Redis 사용 권장
 */

class Cache {
    constructor() {
        this.cache = new Map();
        this.timestamps = new Map();
    }

    /**
     * 캐시에 데이터 저장
     * @param {string} key - 캐시 키
     * @param {any} value - 저장할 값
     * @param {number} ttl - Time To Live (초)
     */
    set(key, value, ttl = 300) {
        this.cache.set(key, value);
        this.timestamps.set(key, Date.now() + (ttl * 1000));
        
        console.log(`💾 캐시 저장: ${key} (TTL: ${ttl}s)`);
    }

    /**
     * 캐시에서 데이터 조회
     * @param {string} key - 캐시 키
     * @returns {any|null} 캐시된 값 또는 null
     */
    get(key) {
        const timestamp = this.timestamps.get(key);
        
        // 만료 확인
        if (timestamp && Date.now() > timestamp) {
            this.delete(key);
            console.log(`⏰ 캐시 만료: ${key}`);
            return null;
        }

        const value = this.cache.get(key);
        if (value) {
            console.log(`✅ 캐시 히트: ${key}`);
        } else {
            console.log(`❌ 캐시 미스: ${key}`);
        }
        
        return value || null;
    }

    /**
     * 캐시 삭제
     * @param {string} key - 캐시 키
     */
    delete(key) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        console.log(`🗑️ 캐시 삭제: ${key}`);
    }

    /**
     * 패턴으로 캐시 삭제
     * @param {string} pattern - 삭제할 키 패턴
     */
deletePattern(pattern) {
    let count = 0;

    // pattern이 RegExp이면 그대로 사용
    const regex = pattern instanceof RegExp
        ? pattern
        : new RegExp(pattern);

    for (const key of this.cache.keys()) {
        if (regex.test(key)) {
            this.delete(key);
            count++;
        }
    }

    console.log(`🗑️ 패턴 삭제: ${regex} (${count}개)`);
}

    /**
     * 전체 캐시 초기화
     */
    clear() {
        const count = this.cache.size;
        this.cache.clear();
        this.timestamps.clear();
        console.log(`🗑️ 전체 캐시 삭제 (${count}개)`);
    }

    /**
     * 캐시 통계
     */
    stats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// 싱글톤 인스턴스
const cache = new Cache();

/**
 * Express 미들웨어: API 응답 캐싱
 * @param {number} ttl - Time To Live (초)
 */
const cacheMiddleware = (ttl = 300) => {
    return (req, res, next) => {
        // GET 요청만 캐싱
        if (req.method !== 'GET') {
            return next();
        }

        const key = `api:${req.originalUrl}`;
        const cachedData = cache.get(key);

        if (cachedData) {
            return res.json(cachedData);
        }

        // 원래 res.json을 오버라이드
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            cache.set(key, data, ttl);
            return originalJson(data);
        };

        next();
    };
};

/**
 * 캐시 무효화 미들웨어
 * POST/PUT/DELETE 요청 시 관련 캐시 삭제
 */
const invalidateCache = (pattern) => {
    return (req, res, next) => {
        // 응답 후 캐시 무효화
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cache.deletePattern(pattern);
            }
        });
        next();
    };
};

module.exports = {
    cache,
    cacheMiddleware,
    invalidateCache
};
