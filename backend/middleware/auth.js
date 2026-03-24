const jwt = require('jsonwebtoken');
const db = require('../config/database');

// JWT 토큰 검증 미들웨어
const authMiddleware = async (req, res, next) => {
    try {
        // 쿠키 우선, 없으면 Authorization 헤더 폴백
        const token = req.cookies?.accessToken ||
            (req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.substring(7)
                : null);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: '인증 토큰이 없습니다.'
            });
        }

        // 토큰 검증
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 사용자 정보 조회
        const [users] = await db.query(
            `SELECT u.*, e.employee_number, e.department_id, e.position, e.status
             FROM users u
             LEFT JOIN employees e ON u.id = e.user_id
             WHERE u.id = ? AND u.is_active = TRUE`,
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: '유효하지 않은 사용자입니다.'
            });
        }

        // 요청 객체에 사용자 정보 추가
        req.user = users[0];
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: '유효하지 않은 토큰입니다.'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: '토큰이 만료되었습니다.'
            });
        }

        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: '인증 처리 중 오류가 발생했습니다.'
        });
    }
};

// 권한 확인 미들웨어
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: '권한이 없습니다.'
            });
        }

        next();
    };
};

// 본인 또는 관리자 확인 미들웨어
const checkOwnerOrAdmin = (req, res, next) => {
    const targetUserId = parseInt(req.params.userId || req.params.id);
    const currentUserId = req.user.id;
    const isAdmin = ['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role);

    if (targetUserId !== currentUserId && !isAdmin) {
        return res.status(403).json({
            success: false,
            message: '본인 또는 관리자만 접근 가능합니다.'
        });
    }

    next();
};

// 관리자 권한 미들웨어
const adminMiddleware = (req, res, next) => {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: '관리자 권한이 필요합니다.'
        });
    }
    next();
};

module.exports = {
    authMiddleware,
    checkRole,
    checkOwnerOrAdmin,
    adminMiddleware
};
