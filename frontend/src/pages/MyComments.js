import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/authService';
import './MyComments.css';
import { IconChat, IconFolder } from '../components/common/Icons';

function MyComments() {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/dashboard/my-comments')
            .then(res => setPosts(res.data.data || []))
            .catch(err => console.error('새 댓글 조회 실패:', err))
            .finally(() => setLoading(false));
    }, []);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        const now = new Date();
        const diffHours = Math.floor((now - d) / (1000 * 60 * 60));
        if (diffHours < 24) {
            return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
            .replace(/\. /g, '.').replace(/\.$/, '');
    };

    return (
        <div className="my-comments-page">
            <div className="my-comments-header">
                <h1 className="my-comments-title">새 댓글</h1>
                <p className="my-comments-subtitle">내 글에 달린 미확인 댓글이 있는 게시물입니다.</p>
            </div>

            {loading ? (
                <div className="my-comments-list">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="my-comments-item">
                            <div className="skel" style={{ height: 14, width: '60%', borderRadius: 4 }} />
                            <div className="skel" style={{ height: 12, width: '30%', borderRadius: 4, marginTop: 8 }} />
                        </div>
                    ))}
                </div>
            ) : posts.length === 0 ? (
                <div className="my-comments-empty">
                    <IconFolder size={40} strokeWidth={1.2} />
                    <p>새 댓글이 없습니다.</p>
                </div>
            ) : (
                <div className="my-comments-list">
                    {posts.map(post => (
                        <div
                            key={post.id}
                            className="my-comments-item"
                            onClick={() => navigate(`/boards/${post.board_id}/posts/${post.id}`)}
                        >
                            <div className="my-comments-item-main">
                                <span className="my-comments-board">{post.board_name}</span>
                                <p className="my-comments-post-title">{post.title}</p>
                            </div>
                            <div className="my-comments-meta">
                                <span className="my-comments-new-badge">
                                    <IconChat size={12} />
                                    새 댓글 {post.new_comment_count}
                                </span>
                                <span className="my-comments-date">{formatDate(post.latest_comment_at)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MyComments;
