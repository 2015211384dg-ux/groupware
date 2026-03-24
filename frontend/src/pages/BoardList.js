import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/authService';
import './BoardList.css';

function BoardList() {
    const navigate = useNavigate();
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedBoards, setSelectedBoards] = useState([]);

    useEffect(() => {
        fetchBoards();
    }, []);

    const fetchBoards = async () => {
        try {
            const response = await api.get('/boards');
            setBoards(response.data.data);
        } catch (error) {
            console.error('게시판 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedBoards(boards.map(b => b.id));
        } else {
            setSelectedBoards([]);
        }
    };

    const handleSelectBoard = (boardId) => {
        if (selectedBoards.includes(boardId)) {
            setSelectedBoards(selectedBoards.filter(id => id !== boardId));
        } else {
            setSelectedBoards([...selectedBoards, boardId]);
        }
    };

    const filteredBoards = boards.filter(board =>
        board.name.toLowerCase().includes(search.toLowerCase())
    );

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return '오늘';
        } else if (diffDays === 1) {
            return '1일 전';
        } else if (diffDays < 7) {
            return `${diffDays}일 전`;
        } else {
            return date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, '');
        }
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="board-list-page-v2">
            {/* 헤더 */}
            <div className="board-header-v2">
                <div className="header-title-v2">
                    <h1>📋 공지사항</h1>
                    <p className="header-subtitle">새로 등록 공지사항이 업데이트되는 게시판입니다.</p>
                </div>
            </div>

            {/* 검색 & 액션 바 */}
            <div className="board-toolbar">
                <div className="toolbar-left">
                    <div className="search-box-v2">
                        <input
                            type="text"
                            placeholder="게시글 검색"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button className="search-btn">🔍</button>
                    </div>
                </div>
                <div className="toolbar-right">
                    <button className="write-btn" onClick={() => navigate('/boards/1/write')}>
                        글쓰기
                    </button>
                </div>
            </div>

            {/* 테이블 */}
            <div className="board-table-container">
                <table className="board-table-v2">
                    <thead>
                        <tr>
                            <th className="col-checkbox">
                                <input
                                    type="checkbox"
                                    checked={selectedBoards.length === filteredBoards.length && filteredBoards.length > 0}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="col-number">구분</th>
                            <th className="col-title">제목</th>
                            <th className="col-author">작성자</th>
                            <th className="col-date">작성일</th>
                            <th className="col-views">조회</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBoards.map((board, index) => (
                            <tr 
                                key={board.id}
                                onClick={() => navigate(`/boards/${board.id}`)}
                                className="board-row"
                            >
                                <td 
                                    className="col-checkbox"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedBoards.includes(board.id)}
                                        onChange={() => handleSelectBoard(board.id)}
                                    />
                                </td>
                               
                                <td className="col-title">
                                    <div className="title-wrapper">
                                        <span className="title-text">{board.name}</span>
                                        {board.description && (
                                            <span className="title-desc">{board.description}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="col-author">
                                    <div className="author-info-v2">
                                        <span className="author-name">시스템관리자</span>
                                        <span className="author-role">이사</span>
                                    </div>
                                </td>
                                <td className="col-date">
                                    {formatDate(board.created_at)}
                                </td>
                                <td className="col-views">
                                    {board.post_count || 0}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredBoards.length === 0 && (
                    <div className="empty-state-v2">
                        <p>검색 결과가 없습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default BoardList;
