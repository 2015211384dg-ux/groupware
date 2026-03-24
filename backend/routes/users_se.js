// users.js에 추가할 라우트들

// ============================================
// 내 설정 조회
// ============================================
router.get('/my-settings', authMiddleware, async (req, res) => {
    try {
        const [settings] = await db.query(
            'SELECT * FROM user_settings WHERE user_id = ?',
            [req.user.id]
        );

        // 설정이 없으면 기본값 반환
        if (settings.length === 0) {
            return res.json({
                success: true,
                data: {
                    email_notifications: true,
                    desktop_notifications: true,
                    post_notifications: true,
                    comment_notifications: true,
                    theme: 'light',
                    language: 'ko',
                    show_birthday: true,
                    show_profile: true
                }
            });
        }

        res.json({
            success: true,
            data: settings[0]
        });
    } catch (error) {
        console.error('Get user settings error:', error);
        res.status(500).json({
            success: false,
            message: '설정 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 내 설정 저장
// ============================================
router.put('/my-settings', authMiddleware, async (req, res) => {
    try {
        const {
            email_notifications,
            desktop_notifications,
            post_notifications,
            comment_notifications,
            theme,
            language,
            show_birthday,
            show_profile
        } = req.body;

        // 기존 설정 확인
        const [existing] = await db.query(
            'SELECT id FROM user_settings WHERE user_id = ?',
            [req.user.id]
        );

        if (existing.length > 0) {
            // 업데이트
            await db.query(`
                UPDATE user_settings SET
                    email_notifications = ?,
                    desktop_notifications = ?,
                    post_notifications = ?,
                    comment_notifications = ?,
                    theme = ?,
                    language = ?,
                    show_birthday = ?,
                    show_profile = ?,
                    updated_at = NOW()
                WHERE user_id = ?
            `, [
                email_notifications,
                desktop_notifications,
                post_notifications,
                comment_notifications,
                theme,
                language,
                show_birthday,
                show_profile,
                req.user.id
            ]);
        } else {
            // 새로 생성
            await db.query(`
                INSERT INTO user_settings (
                    user_id,
                    email_notifications,
                    desktop_notifications,
                    post_notifications,
                    comment_notifications,
                    theme,
                    language,
                    show_birthday,
                    show_profile
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                req.user.id,
                email_notifications,
                desktop_notifications,
                post_notifications,
                comment_notifications,
                theme,
                language,
                show_birthday,
                show_profile
            ]);
        }

        res.json({
            success: true,
            message: '설정이 저장되었습니다.'
        });
    } catch (error) {
        console.error('Save user settings error:', error);
        res.status(500).json({
            success: false,
            message: '설정 저장 중 오류가 발생했습니다.'
        });
    }
});
