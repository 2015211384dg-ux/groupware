// PostDetail.js
import DOMPurify from 'dompurify';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/authService';
import './PostDetail.css';
import { useToast } from '../components/Toast';
import { IconPaperclip, IconDownload, IconPin, IconPinOff, IconHeart } from '../components/Icons';

const ADMIN_ROLES = ['SUPER_ADMIN', 'HR_ADMIN'];

function PostDetail({ user }) {
  const { boardId, postId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [post, setPost] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = ADMIN_ROLES.includes(user?.role);

  const [isLiked, setIsLiked] = useState(false);

  // ✅ 넓게보기 토글 + 저장
  const [isWideView, setIsWideView] = useState(false);

  // ✅ 댓글
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');

  const [replyTo, setReplyTo] = useState(null); // { id, author_name }
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const wideKey = useMemo(() => `postDetailWideView:${boardId || 'default'}`, [boardId]);

  useEffect(() => {
    // wide-view 복원
    try {
      const saved = localStorage.getItem(wideKey);
      if (saved === '1') setIsWideView(true);
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wideKey]);

  useEffect(() => {
    // wide-view 저장
    try {
      localStorage.setItem(wideKey, isWideView ? '1' : '0');
    } catch (e) {}
  }, [isWideView, wideKey]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const fetchAll = async () => {
    await fetchPost();
    await fetchComments();
  };

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/posts/${postId}`);
      const data = response?.data?.data;

      setPost(data?.post || data || null);

      // attachments 표준화
      const rawFiles = data?.attachments || data?.post?.attachments || [];
      const normalized = (rawFiles || []).map((f) => ({
        id: f.id,
        originalName: f.original_name || f.original_filename || f.originalName || f.filename || '',
        filename: f.saved_name || f.filename || '',
        filepath: f.file_path || f.filepath || f.filePath || '',
        filesize: f.file_size || f.filesize || f.fileSize || 0,
        mimetype: f.mime_type || f.mimetype || f.mimeType || '',
      }));

      setAttachments(normalized);
      setIsLiked(!!data?.isLiked);
    } catch (error) {
      console.error('게시글 조회 실패:', error);
      toast.error('게시글을 찾을 수 없습니다.');
      navigate(`/boards/${boardId}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 댓글 API는 프로젝트마다 경로가 다를 수 있어서,
  // 1순위: /posts/:postId/comments
  // 실패 시: /comments?postId=:postId
  const fetchComments = async () => {
    try {
      const res = await api.get('/comments', { params: { post_id: postId } });
      const list = res?.data?.data ?? res?.data ?? [];
      setComments(Array.isArray(list) ? list : []);
      return;
    } catch (e) {
      try {
        const res2 = await api.get(`/comments`, { params: { postId } });
        const list2 = res2?.data?.data ?? res2?.data ?? [];
        setComments(Array.isArray(list2) ? list2 : []);
      } catch (e2) {
        console.error('댓글 조회 실패:', e2);
        setComments([]);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ko-KR');
  };

  const formatFileSize = (bytes) => {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const cleanTitle = (title) => {
    const t = (title ?? '').toString();
    return t.replace(/^0{2}\s+/, '').trimStart();
  };

  const downloadAttachment = async (attachmentId, originalName) => {
    try {
      const res = await api.get(`/attachments/download/${attachmentId}`, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('파일 다운로드 실패:', err);
      toast.error('파일 다운로드 실패');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    try {
      await api.delete(`/posts/${postId}`);
      toast.success('삭제되었습니다.');
      navigate(`/boards/${boardId}`);
    } catch (err) {
      console.error('삭제 실패:', err);
      toast.error('삭제 실패');
    }
  };

  const handleTogglePin = async () => {
    try {
      await api.patch(`/posts/${postId}/pin`);
      await fetchPost();
    } catch (err) {
      console.error('고정 처리 실패:', err);
      toast.error('고정 처리 실패');
    }
  };

  const deleteComment = async (commentId) => {
  if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
  try {
    await api.delete(`/comments/${commentId}`);
    await fetchComments();
  } catch (e) {
    console.error('댓글 삭제 실패:', e?.response?.data || e);
    toast.error(e?.response?.data?.message || '댓글 삭제 실패');
  }
};

  const handleLike = async () => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      setIsLiked(res?.data?.data?.isLiked ?? !isLiked);
      await fetchPost();
    } catch (err) {
      console.error('좋아요 실패:', err);
    }
  };

  const normalizeComment = (c) => {
    // 필드명 흔들림 방어
    const id = c?.id ?? c?.comment_id ?? c?._id;
    const parentId = c?.parent_id ?? c?.parentId ?? c?.parent_comment_id ?? null;

    return {
      raw: c,
      id,
      parentId,
      authorName: c?.author_name ?? c?.authorName ?? c?.writer_name ?? c?.user_name ?? '익명',
      authorPosition: c?.author_position ?? c?.authorPosition ?? c?.writer_position ?? '',
      content: c?.content ?? c?.comment ?? c?.body ?? '',
      createdAt: c?.created_at ?? c?.createdAt ?? c?.reg_dt ?? c?.date ?? '',
    };
  };

  const normalizedComments = useMemo(() => {
    return (comments || [])
      .map(normalizeComment)
      .filter((c) => c.id != null)
      .sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
        return ta - tb;
      });
  }, [comments]);

  const { topLevel, childrenMap } = useMemo(() => {
    const map = new Map();
    const roots = [];
    for (const c of normalizedComments) {
      const pid = c.parentId == null ? null : c.parentId;
      if (pid == null) roots.push(c);
      else {
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid).push(c);
      }
    }
    return { topLevel: roots, childrenMap: map };
  }, [normalizedComments]);

  const cancelReply = () => {
    setReplyTo(null);
    setReplyText('');
  };

  const openReply = (comment) => {
    setReplyTo({ id: comment.id, authorName: comment.authorName });
    setReplyText('');
    const el = document.getElementById('reply-box-anchor');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

const submitComment = async () => {
  const text = (commentText || '').trim();
  if (!text) return;

  setSubmitting(true);
  try {
    // ✅ 여기 핵심: post_id
    await api.post('/comments', { post_id: Number(postId), content: text });

    setCommentText('');
    await fetchComments(); // GET 붙였으면
  } catch (e) {
    console.error('댓글 등록 실패:', e?.response?.data || e);
    toast.error(e?.response?.data?.message || '댓글 등록 실패');
  } finally {
    setSubmitting(false);
  }
};

const submitReply = async () => {
  if (!replyTo?.id) return;
  const text = (replyText || '').trim();
  if (!text) return;

  setSubmitting(true);
  try {
    await api.post('/comments', {
      post_id: Number(postId),
      parent_id: Number(replyTo.id),
      content: text
    });

    cancelReply();
    await fetchComments();
  } catch (e) {
    console.error('답글 등록 실패:', e?.response?.data || e);
    toast.error(e?.response?.data?.message || '답글 등록 실패');
  } finally {
    setSubmitting(false);
  }
};

  const renderCommentItem = (c, depth = 0) => {
    const replies = childrenMap.get(c.id) || [];
    const isReply = depth > 0;

    return (
      <div key={c.id} className={`comment-card ${isReply ? 'reply' : ''}`}>
        <div className="comment-card-top">
          <div className="comment-avatar-v2">
            {(c.authorName || 'U').toString().charAt(0)}
          </div>

          <div className="comment-body">
            <div className="comment-meta-row">
              <div className="comment-author">
                <span className="comment-author-name">{c.authorName}</span>
                {c.authorPosition ? (
                  <span className="comment-author-badge">{c.authorPosition}</span>
                ) : null}
              </div>

              <div className="comment-date">{formatDate(c.createdAt)}</div>
            </div>

            <div className="comment-text">{c.content}</div>

            <div className="comment-actions-row no-print">
                <button className="comment-action-btn" onClick={() => openReply(c)}>답글</button>
                <button className="comment-action-btn danger" onClick={() => deleteComment(c.id)}>삭제</button>
            </div>
          </div>
        </div>

        {replies.length > 0 ? (
          <div className="comment-replies">
            {replies.map((rc) => renderCommentItem(rc, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  if (loading) return <div style={{ padding: 24 }}>로딩 중...</div>;
  if (!post) return null;

  return (
    <div className={`post-detail-page-v2 ${isWideView ? 'wide-view' : ''}`}>
      <div className="post-container-v2">
        {/* 상단 액션 바 */}
        <div className="detail-header no-print">
          <div className="header-left">
            <button className="back-button" onClick={() => navigate(`/boards/${boardId}`)}>
              ← 목록
            </button>
          </div>

          <div className="header-right">
            <button
              className={`wide-view-toggle ${isWideView ? 'active' : ''}`}
              onClick={() => setIsWideView((v) => !v)}
              type="button"
            >
              본문 넓게 보기
            </button>

            {isAdmin && (
              <button
                className={`pin-post-btn ${post?.is_pinned ? 'pinned' : ''}`}
                onClick={handleTogglePin}
                type="button"
              >
                {post?.is_pinned
                  ? <><IconPinOff size={15} /> 고정 해제</>
                  : <><IconPin size={15} /> 고정하기</>
                }
              </button>
            )}

            <button className="options-button" onClick={handleDelete} type="button">
              삭제
            </button>
          </div>
        </div>
        {/* 본문 내용 래퍼 (넓게 보기 제어) */}
        <div className="post-body-inner">
        {/* 제목 + 작성자 통합 헤더 */}
        <div className="post-header-block">
          <div className="post-title-row">
            {post.category && <span className="post-category-badge">{post.category}</span>}
            <h1 className="post-title-v2">{cleanTitle(post.title)}</h1>
          </div>
          <div className="post-meta-row">
            <div className="author-avatar-v2">{post.author_name?.charAt(0) || 'U'}</div>
            <div className="post-meta-info">
              <span className="meta-author-name">{post.author_name}</span>
              {post.author_position && (
                <span className="author-position-badge">{post.author_position}</span>
              )}
              <span className="meta-sep">·</span>
              <span className="meta-date">{formatDate(post.created_at)}</span>
              <span className="meta-sep">·</span>
              <span className="meta-views">조회 {post.view_count}</span>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="post-content-v2">
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }} />
        </div>

        {/* 첨부파일 */}
        {attachments.length > 0 && (
          <div className="attachments-section compact">
            <h4 className="attachments-title"><IconPaperclip size={15} /> 첨부파일 ({attachments.length})</h4>

            <div className="attachments-list compact">
              {attachments.map((file) => (
                <div key={file.id} className="attachment-item compact">
                  <div className="file-info">
                    <div className="file-name">{file.originalName}</div>
                    <div className="file-size">{formatFileSize(file.filesize)}</div>
                  </div>
                  <button
                    className="download-btn"
                    onClick={() => downloadAttachment(file.id, file.originalName)}
                    type="button"
                  >
                    <IconDownload size={14} /> 다운로드
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 좋아요 */}
        <div className="post-bottom-actions no-print">
          <button
            className={`like-button-v2 ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
            type="button"
          >
            <IconHeart size={15} /> 좋아요 {post.like_count || 0}
          </button>
        </div>

        {/* ✅ 댓글 섹션 (토스 스타일 카드) */}
        <div className="comments-section-v3">
          <div className="comments-header-row">
            <h3 className="comments-title-v3">댓글</h3>
            <div className="comments-count-badge">{normalizedComments.length}</div>
          </div>

          {/* 댓글 작성 */}
          <div className="comment-compose-card">
            <textarea
              className="comment-textarea-v3"
              placeholder="댓글을 입력하세요"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
            />
            <div className="comment-compose-footer">
              <div className="comment-hint">Shift+Enter 줄바꿈</div>
              <button
                className="comment-submit-v3"
                onClick={submitComment}
                disabled={submitting || !(commentText || '').trim()}
                type="button"
              >
                등록
              </button>
            </div>
          </div>

          {/* 답글 작성 */}
          <div id="reply-box-anchor" />
          {replyTo ? (
            <div className="reply-compose-card no-print">
              <div className="replying-to">
                <span className="replying-pill">
                  {replyTo.authorName}님에게 답글
                </span>
                <button className="reply-cancel-btn" onClick={cancelReply} type="button">
                  취소
                </button>
              </div>

              <textarea
                className="comment-textarea-v3"
                placeholder="답글을 입력하세요"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
              />

              <div className="comment-compose-footer">
                <div className="comment-hint" />
                <button
                  className="comment-submit-v3"
                  onClick={submitReply}
                  disabled={submitting || !(replyText || '').trim()}
                  type="button"
                >
                  답글 등록
                </button>
              </div>
            </div>
          ) : null}

          {/* 댓글 목록 */}
          <div className="comments-list-v3">
            {topLevel.length === 0 ? (
              <div className="comments-empty">
                아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
              </div>
            ) : (
              topLevel.map((c) => renderCommentItem(c, 0))
            )}
          </div>
        </div>
        </div>{/* end post-body-inner */}
      </div>
    </div>
  );
}

export default PostDetail;