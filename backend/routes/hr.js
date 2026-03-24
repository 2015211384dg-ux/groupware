const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// TODO: Phase 4에서 구현 예정
// - 인사 정보 관리
// - 근태 관리
// - 연차 신청/승인
// - 입퇴사 체크리스트

router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Phase 4에서 구현 예정'
    });
});

module.exports = router;
