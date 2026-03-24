import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/authService';
import './BoardList.css';
import { IconBoard, IconChevronRight } from '../components/Icons';

function BoardList() {
    const navigate = useNavigate();
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/boards')
            .then(res => setBoards(res.data.data || []))
            .catch(err => console.error('게시판 목록 조회 실패:', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="boardlist-page">
            <div className="boardlist-header">
                <h1 className="boardlist-title">게시판</h1>
                <p className="boardlist-subtitle">이용 가능한 게시판 목록입니다.</p>
            </div>

            <div className="boardlist-grid">
                {boards.map((board) => (
                    <div
                        key={board.id}
                        className="board-card"
                        onClick={() => navigate(`/boards/${board.id}`)}
                    >
                        <div className="board-card-icon">
                            <IconBoard size={22} />
                        </div>
                        <div className="board-card-body">
                            <span className="board-card-name">{board.name}</span>
                            {board.description && (
                                <span className="board-card-desc">{board.description}</span>
                            )}
                        </div>
                        <div className="board-card-meta">
                            <span className="board-card-count">게시글 {board.post_count || 0}개</span>
                            <IconChevronRight size={16} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default BoardList;
