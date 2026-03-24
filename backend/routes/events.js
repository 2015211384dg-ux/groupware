const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// 모든 라우트에 인증 미들웨어 적용
router.use(authMiddleware);

// ============================================
// 월별 일정 조회
// ============================================
router.get('/monthly/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        
        // 해당 월의 시작일과 종료일
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0); // 다음 달 0일 = 이번 달 마지막 일
        const endDateStr = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`;

        const [events] = await db.query(`
            SELECT e.*,
                   u.name as creator_name,
                   d.name as department_name
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE (
                (e.start_date BETWEEN ? AND ?) OR
                (e.end_date BETWEEN ? AND ?) OR
                (e.start_date <= ? AND e.end_date >= ?)
            )
            AND (
                e.visibility = 'public' OR
                e.created_by = ? OR
                (e.visibility = 'department' AND e.department_id = ?)
            )
            ORDER BY e.start_date, e.start_time
        `, [
            startDate, endDateStr,
            startDate, endDateStr,
            startDate, endDateStr,
            req.user.id,
            req.user.department_id
        ]);

        res.json({
            success: true,
            data: events
        });

    } catch (error) {
        console.error('Get monthly events error:', error);
        res.status(500).json({
            success: false,
            message: '일정 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 일정 상세 조회
// ============================================
router.get('/:id', async (req, res) => {
    try {
        const [events] = await db.query(`
            SELECT e.*,
                   u.name as creator_name,
                   d.name as department_name
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE e.id = ?
        `, [req.params.id]);

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: '일정을 찾을 수 없습니다.'
            });
        }

        // 참가자 조회
        const [participants] = await db.query(`
            SELECT ep.*, u.name as user_name, u.email
            FROM event_participants ep
            LEFT JOIN users u ON ep.user_id = u.id
            WHERE ep.event_id = ?
        `, [req.params.id]);

        res.json({
            success: true,
            data: {
                ...events[0],
                participants
            }
        });

    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({
            success: false,
            message: '일정 조회 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 일정 생성
// ============================================
router.post('/', async (req, res) => {
    try {
        const {
            title,
            description,
            start_date,
            end_date,
            start_time,
            end_time,
            all_day,
            category,
            visibility,
            department_id,
            color,
            location,
            participants
        } = req.body;

        if (!title || !start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: '필수 항목을 입력해주세요.'
            });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 일정 생성
            const [result] = await connection.query(`
                INSERT INTO events (
                    title, description, start_date, end_date,
                    start_time, end_time, all_day, category,
                    visibility, department_id, color, location,
                    created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                title, description, start_date, end_date,
                start_time || null, end_time || null, all_day || false,
                category || 'general', visibility || 'public',
                department_id || null, color || '#667eea',
                location || null, req.user.id
            ]);

            const eventId = result.insertId;

            // 참가자 추가
            if (participants && participants.length > 0) {
                const participantValues = participants.map(userId => [eventId, userId]);
                await connection.query(
                    'INSERT INTO event_participants (event_id, user_id) VALUES ?',
                    [participantValues]
                );
            }

            await connection.commit();

            res.status(201).json({
                success: true,
                message: '일정이 등록되었습니다.',
                data: { id: eventId }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({
            success: false,
            message: '일정 등록 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 일정 수정
// ============================================
router.put('/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        const {
            title,
            description,
            start_date,
            end_date,
            start_time,
            end_time,
            all_day,
            category,
            visibility,
            department_id,
            color,
            location,
            participants
        } = req.body;

        // 권한 확인
        const [events] = await db.query(
            'SELECT created_by FROM events WHERE id = ?',
            [eventId]
        );

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: '일정을 찾을 수 없습니다.'
            });
        }

        if (events[0].created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '수정 권한이 없습니다.'
            });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 일정 수정
            await connection.query(`
                UPDATE events SET
                    title = ?,
                    description = ?,
                    start_date = ?,
                    end_date = ?,
                    start_time = ?,
                    end_time = ?,
                    all_day = ?,
                    category = ?,
                    visibility = ?,
                    department_id = ?,
                    color = ?,
                    location = ?
                WHERE id = ?
            `, [
                title, description, start_date, end_date,
                start_time || null, end_time || null, all_day || false,
                category, visibility, department_id || null,
                color, location || null, eventId
            ]);

            // 기존 참가자 삭제 후 재등록
            if (participants) {
                await connection.query(
                    'DELETE FROM event_participants WHERE event_id = ?',
                    [eventId]
                );

                if (participants.length > 0) {
                    const participantValues = participants.map(userId => [eventId, userId]);
                    await connection.query(
                        'INSERT INTO event_participants (event_id, user_id) VALUES ?',
                        [participantValues]
                    );
                }
            }

            await connection.commit();

            res.json({
                success: true,
                message: '일정이 수정되었습니다.'
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({
            success: false,
            message: '일정 수정 중 오류가 발생했습니다.'
        });
    }
});

// ============================================
// 일정 삭제
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const eventId = req.params.id;

        // 권한 확인
        const [events] = await db.query(
            'SELECT created_by FROM events WHERE id = ?',
            [eventId]
        );

        if (events.length === 0) {
            return res.status(404).json({
                success: false,
                message: '일정을 찾을 수 없습니다.'
            });
        }

        if (events[0].created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '삭제 권한이 없습니다.'
            });
        }

        await db.query('DELETE FROM events WHERE id = ?', [eventId]);

        res.json({
            success: true,
            message: '일정이 삭제되었습니다.'
        });

    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({
            success: false,
            message: '일정 삭제 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;
