// comments.js (교체용 전체)
// - GET /comments?post_id=123 : 댓글 목록 (대댓글 트리 정렬)
// - POST /comments : 댓글/대댓글 작성 (기존 유지)
// - PUT /comments/:id : 댓글 수정 (기존 유지)
// - DELETE /comments/:id : 댓글 삭제 soft delete (기존 유지)

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { invalidateCache } = require('../middleware/cache');
const db = require('../config/database');
const { createNotification } = require('../utils/notificationHelper');

router.use(authMiddleware);

/**
 * 대댓글 정렬(트리 -> 플랫 배열)
 * - 부모 댓글 먼저, 그 아래에 자식 댓글을 시간순으로 붙임
 * - parent가 삭제됐더라도(내용이 "삭제된 댓글입니다.") 구조는 유지
 */
function buildThreadedList(rows) {
  const byId = new Map();
  const children = new Map(); // key: parentId, value: array

  // normalize
  const items = rows.map((r) => ({
    id: r.id,
    post_id: r.post_id,
    user_id: r.user_id,
    parent_id: r.parent_id,
    content: r.content,
    is_deleted: !!r.is_deleted,
    created_at: r.created_at,
    updated_at: r.updated_at,
    author_name: r.author_name,
    author_position: r.author_position,
  }));

  for (const it of items) {
    byId.set(it.id, it);
    const pid = it.parent_id ?? null;
    if (!children.has(pid)) children.set(pid, []);
    children.get(pid).push(it);
  }

  const sortByTimeAsc = (a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    // created_at이 null/문자열 이상일 때도 안전하게
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return -1;
    if (Number.isNaN(tb)) return 1;
    return ta - tb;
  };

  // 각 레벨별 정렬
  for (const [, arr] of children.entries()) {
    arr.sort(sortByTimeAsc);
  }

  // root = parent_id 가 null OR (부모가 존재하지 않는 경우)도 root로 처리
  const roots = [];
  for (const it of items) {
    const pid = it.parent_id ?? null;
    if (pid === null) roots.push(it);
    else if (!byId.has(pid)) roots.push(it);
  }
  roots.sort(sortByTimeAsc);

  const out = [];
  const visited = new Set();

  const dfs = (node, depth) => {
    if (!node || visited.has(node.id)) return;
    visited.add(node.id);

    out.push({
      ...node,
      depth, // 프론트에서 reply 스타일 처리에 사용 가능
    });

    const kids = children.get(node.id) || [];
    for (const k of kids) dfs(k, depth + 1);
  };

  for (const r of roots) dfs(r, 0);

  // 혹시라도 남은 고아 노드가 있으면 끝에 추가
  for (const it of items) {
    if (!visited.has(it.id)) dfs(it, 0);
  }

  return out;
}

// ============================================
// 댓글 목록 조회 (GET)
// GET /comments?post_id=123
// - 반환: 대댓글 정렬된 배열(부모 -> 자식 순)
// ============================================
router.get('/', async (req, res) => {
  try {
    const post_id = req.query.post_id;

    if (!post_id) {
      return res.status(400).json({
        success: false,
        message: 'post_id가 필요합니다.'
      });
    }

    // 게시글 존재 확인(삭제글 제외)
    const [posts] = await db.query(
      'SELECT id FROM posts WHERE id = ? AND is_deleted = FALSE',
      [post_id]
    );

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: '게시글을 찾을 수 없습니다.'
      });
    }

    // 댓글 전체 조회 (삭제된 댓글 포함: 구조 유지용)
    const [rows] = await db.query(
      `SELECT c.*,
              u.name as author_name,
              e.position as author_position
       FROM comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC, c.id ASC`,
      [post_id]
    );

    const threaded = buildThreadedList(rows);

    res.json({
      success: true,
      data: threaded
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: '댓글 조회 중 오류가 발생했습니다.'
    });
  }
});


// ============================================
// 댓글 작성
// POST /comments
// body: { post_id, parent_id(optional), content }
// ============================================
router.post('/', invalidateCache(/^api:.*\/api\/v1\/posts/), async (req, res) => {
  try {
    const { post_id, parent_id, content } = req.body;

    if (!post_id || !content) {
      return res.status(400).json({
        success: false,
        message: '필수 항목을 입력해주세요.'
      });
    }

    // 게시글 존재 확인
    const [posts] = await db.query(
      'SELECT id FROM posts WHERE id = ? AND is_deleted = FALSE',
      [post_id]
    );

    if (posts.length === 0) {
      return res.status(404).json({
        success: false,
        message: '게시글을 찾을 수 없습니다.'
      });
    }

    // parent_id가 있을 경우, 해당 댓글이 같은 post의 댓글인지 확인(안전)
    if (parent_id) {
      const [parentRows] = await db.query(
        'SELECT id FROM comments WHERE id = ? AND post_id = ?',
        [parent_id, post_id]
      );
      if (parentRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'parent_id가 올바르지 않습니다.'
        });
      }
    }

    const [result] = await db.query(
      `INSERT INTO comments (post_id, user_id, parent_id, content)
       VALUES (?, ?, ?, ?)`,
      [post_id, req.user.id, parent_id || null, content]
    );

    // 작성한 댓글 조회
    const [comments] = await db.query(
      `SELECT c.*,
              u.name as author_name,
              e.position as author_position
       FROM comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE c.id = ?`,
      [result.insertId]
    );

    // 게시글 작성자에게 알림 (본인 제외)
    const [[post]] = await db.query(
      `SELECT p.user_id, p.title, p.board_id FROM posts p WHERE p.id = ?`, [post_id]
    );
    if (post && post.user_id !== req.user.id) {
      createNotification(post.user_id, {
        type: 'comment',
        title: `댓글: ${post.title}`,
        body: `${req.user.name}님이 댓글을 남겼습니다.`,
        url: `/boards/${post.board_id}/posts/${post_id}`
      }, 'comment_notifications');
    }
    // 대댓글인 경우 부모 댓글 작성자에게도 알림
    if (parent_id) {
      const [[parentComment]] = await db.query(
        'SELECT user_id FROM comments WHERE id = ?', [parent_id]
      );
      if (parentComment && parentComment.user_id !== req.user.id &&
          parentComment.user_id !== post?.user_id) {
        createNotification(parentComment.user_id, {
          type: 'comment',
          title: `대댓글: ${post?.title || '게시글'}`,
          body: `${req.user.name}님이 대댓글을 남겼습니다.`,
          url: `/boards/${post?.board_id}/posts/${post_id}`
        }, 'comment_notifications');
      }
    }

    res.status(201).json({
      success: true,
      message: '댓글이 작성되었습니다.',
      data: comments[0]
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      success: false,
      message: '댓글 작성 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 댓글 수정
// ============================================
router.put('/:id', invalidateCache(/^api:.*\/api\/v1\/posts/), async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: '내용을 입력해주세요.'
      });
    }

    const [comments] = await db.query(
      'SELECT user_id FROM comments WHERE id = ?',
      [req.params.id]
    );

    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: '댓글을 찾을 수 없습니다.'
      });
    }

    if (comments[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '수정 권한이 없습니다.'
      });
    }

    await db.query(
      'UPDATE comments SET content = ? WHERE id = ?',
      [content, req.params.id]
    );

    res.json({
      success: true,
      message: '댓글이 수정되었습니다.'
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      success: false,
      message: '댓글 수정 중 오류가 발생했습니다.'
    });
  }
});
// ============================================
// 댓글 삭제 (hard delete: 삭제하면 완전히 없어짐)
// - 작성자 또는 관리자만 가능
// - 부모 삭제 시 대댓글도 함께 삭제
// ============================================
router.delete('/:id', invalidateCache(/^api:.*\/api\/v1\/posts/), async (req, res) => {
  const conn = await db.getConnection();

  try {
    const commentId = Number(req.params.id);
    if (!commentId) {
      return res.status(400).json({ success: false, message: '유효하지 않은 댓글 id입니다.' });
    }

    const [rows] = await conn.query(
      'SELECT id, user_id FROM comments WHERE id = ?',
      [commentId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '댓글을 찾을 수 없습니다.' });
    }

    const isOwner = rows[0].user_id === req.user.id;
    const isAdmin = new Set(['SUPER_ADMIN', 'HR_ADMIN']).has(req.user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: '삭제 권한이 없습니다.' });
    }

    await conn.beginTransaction();
    await conn.query('DELETE FROM comments WHERE parent_id = ?', [commentId]);
    await conn.query('DELETE FROM comments WHERE id = ?', [commentId]);
    await conn.commit();

    return res.json({ success: true, message: '댓글이 삭제되었습니다.' });
  } catch (error) {
    try { await conn.rollback(); } catch (e) {}
    console.error('Delete comment error:', error);
    return res.status(500).json({ success: false, message: '댓글 삭제 중 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;