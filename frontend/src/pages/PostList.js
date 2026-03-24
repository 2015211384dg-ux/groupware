import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/authService';
import './PostList.css';
import { getCategoryColor } from '../utils/categoryColor';
import { IconPin, IconPaperclip, IconHeart, IconFolder } from '../components/Icons';

function PostList({ user }) {
    const { boardId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [board, setBoard] = useState(null);
    const [pinnedPosts, setPinnedPosts] = useState([]);
    const [posts, setPosts] = useState([]);
    const [pagination, setPagination] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedPosts, setSelectedPosts] = useState([]);

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

    useEffect(() => {
        fetchBoard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardId]);

    useEffect(() => {
        fetchPosts();
        const params = {};
        if (page > 1) params.page = page;
        if (search) params.search = search;
        setSearchParams(params, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardId, page]);

    const fetchBoard = async () => {
        try {
            const response = await api.get(`/boards/${boardId}`);
            setBoard(response.data.data);
        } catch (error) {
            console.error('게시판 조회 실패:', error);
        }
    };

    const fetchPosts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/posts', {
                params: { board_id: boardId, page, search, limit: 10 }
            });
            setPinnedPosts(response.data.data.pinnedPosts || []);
            setPosts(response.data.data.posts || []);
            setPagination(response.data.data.pagination || {});
        } catch (error) {
            console.error('게시글 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchPosts();
        const params = {};
        if (search) params.search = search;
        setSearchParams(params, { replace: true });
    };

    const toggleSelectPost = (postId) => {
        setSelectedPosts(prev =>
            prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
        );
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime())) return '';
        const now = new Date();
        const diffHours = Math.floor((now - d) / (1000 * 60 * 60));
        if (diffHours < 24) {
            return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
            .replace(/\. /g, '.')
            .replace(/\.$/, '');
    };

    const cleanTitle = (title) => {
        let t = (title ?? '').toString();
        t = t.replace(/^[\uFEFF\u200B\u200C\u200D\u00A0\s]+/g, '');
        t = t.replace(/^(?:00|００)[\uFEFF\u200B\u200C\u200D\u00A0\s]*/u, '');
        return t.trimStart();
    };

    const formatCategory = (post) => {
        const c = (post.category || '').toString().trim();
        const label = post.is_notice ? '공지' : ((c && c !== '00') ? c : '일반');
        return { label, cls: 'badge', style: getCategoryColor(label) };
    };

    const renderRow = (post, isPinned) => {
        const cat = formatCategory(post);
        const titleLabel = cleanTitle(post.title);
        return (
            <tr
                key={post.id}
                className={`${post.is_notice ? 'notice' : ''} ${isPinned ? 'pinned' : ''}`}
            >
                <td className="col-check center">
                    <input
                        type="checkbox"
                        checked={selectedPosts.includes(post.id)}
                        onChange={() => toggleSelectPost(post.id)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </td>
                <td className="col-category center">
                    {isPinned
                        ? <span className="pin-icon-badge"><IconPin size={14} /></span>
                        : <span className={`badge ${cat.cls}`} style={cat.style}>{cat.label}</span>
                    }
                </td>
                <td
                    className="col-title"
                    onClick={() => navigate(`/boards/${boardId}/posts/${post.id}`)}
                >
                    <div className="post-title-wrap">
                        <span className="post-title-text">{titleLabel}</span>
                        {post.comment_count > 0 && (
                            <span className="comment-badge">[{post.comment_count}]</span>
                        )}
                        {post.attachment_count > 0 && (
                            <span className="attachment-icon"><IconPaperclip size={13} /></span>
                        )}
                    </div>
                </td>
                <td className="col-author center">
                    <div className="author-cell">
                        <span className="author-name">{post.author_name}</span>
                        {post.author_position && (
                            <span className="author-position">{post.author_position}</span>
                        )}
                    </div>
                </td>
                <td className="col-date center">
                    {formatDateTime(post.created_at)}
                </td>
                <td className="col-stats center">
                    <span className="view-count">{post.view_count}</span>
                    {post.like_count > 0 && (
                        <span className="like-count"><IconHeart size={12} /> {post.like_count}</span>
                    )}
                </td>
            </tr>
        );
    };

    if (loading) {
        return (
            <div className="post-list-page-v2">
                <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>로딩 중...</div>
            </div>
        );
    }

    const allEmpty = pinnedPosts.length === 0 && posts.length === 0;

    return (
        <div className="post-list-page-v2">
            {/* 상단 헤더 */}
            <div className="post-list-wrap">
                <div className="board-header">
                    <div className="header-top">
                        <h2 className="board-title">{board?.name || '게시판'}</h2>
                    </div>
                    <div className="header-search">
                        <form className="search-form" onSubmit={handleSearch}>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="제목/내용 검색"
                            />
                            <button type="submit">검색</button>
                        </form>
                    </div>
                    <button
                        className="write-btn-primary"
                        onClick={() => navigate(`/boards/${boardId}/write`)}
                    >
                        + 글쓰기
                    </button>
                </div>
            </div>

            {/* 컨텐츠 */}
            <div className="posts-container">
                <div className="posts-table-wrap">
                    <div className="table-scroll-area">
                        <table className="posts-table">
                            <thead>
                                <tr>
                                    <th className="col-check center">
                                        <input
                                            type="checkbox"
                                            checked={posts.length > 0 && selectedPosts.length === posts.length}
                                            onChange={() => {
                                                if (selectedPosts.length === posts.length) setSelectedPosts([]);
                                                else setSelectedPosts(posts.map(p => p.id));
                                            }}
                                        />
                                    </th>
                                    <th className="col-category center">구분</th>
                                    <th className="col-title">제목</th>
                                    <th className="col-author center">작성자</th>
                                    <th className="col-date center">작성일</th>
                                    <th className="col-stats center">조회</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* 고정글: 항상 모든 페이지 상단에 표시 */}
                                {pinnedPosts.map(post => renderRow(post, true))}

                                {/* 고정글과 일반글 사이 구분선 */}
                                {pinnedPosts.length > 0 && posts.length > 0 && (
                                    <tr className="pin-divider-row">
                                        <td colSpan={6} className="pin-divider" />
                                    </tr>
                                )}

                                {/* 일반글 */}
                                {posts.map(post => renderRow(post, false))}
                            </tbody>
                        </table>

                        {allEmpty && (
                            <div className="empty-state">
                                <div className="empty-icon"><IconFolder size={40} strokeWidth={1.2} /></div>
                                <p>{search ? '검색 결과가 없습니다.' : '게시글이 없습니다.'}</p>
                                {!search && (
                                    <button
                                        className="empty-write-btn"
                                        onClick={() => navigate(`/boards/${boardId}/write`)}
                                    >
                                        첫 글 작성하기
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 페이지네이션 */}
                    {pagination?.totalPages >= 1 && (
                        <div className="pagination">
                            <button className="page-btn" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
                            <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>이전</button>
                            <div className="page-numbers">
                                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                                    .slice(Math.max(0, page - 3), Math.min(pagination.totalPages, page + 2))
                                    .map(num => (
                                        <button
                                            key={num}
                                            className={`page-num ${num === page ? 'active' : ''}`}
                                            onClick={() => setPage(num)}
                                        >
                                            {num}
                                        </button>
                                    ))}
                            </div>
                            <button className="page-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}>다음</button>
                            <button className="page-btn" disabled={page >= pagination.totalPages} onClick={() => setPage(pagination.totalPages)}>»</button>
                            {pagination.totalPages > 1 && (
                                <div className="page-jump-form">
                                    <select
                                        className="page-jump-select"
                                        value={page}
                                        onChange={(e) => setPage(Number(e.target.value))}
                                    >
                                        {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(num => (
                                            <option key={num} value={num}>{num} 페이지</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PostList;
