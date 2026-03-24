import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/authService';
import { useDebounce } from '../hooks/useDebounce';
import './Search.css';
import { IconSearch, IconPaperclip } from '../components/Icons';
import { useToast } from '../components/Toast';

function Search() {
    const toast = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
    const [results, setResults] = useState([]);
    const [boards, setBoards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    
    // 디바운스 적용
    const debouncedKeyword = useDebounce(keyword, 500);
    
    // 필터 상태
    const [filters, setFilters] = useState({
        board_id: '',
        category: '',
        author: '',
        start_date: '',
        end_date: ''
    });

    useEffect(() => {
        fetchBoards();
        if (searchParams.get('keyword')) {
            handleSearch();
        }
    }, []);

    useEffect(() => {
        if (debouncedKeyword && debouncedKeyword.length >= 2) {
            handleSearch();
        } else if (debouncedKeyword.length === 0) {
            setResults([]);
        }
    }, [debouncedKeyword]);

    const fetchBoards = async () => {
        try {
            const response = await api.get('/boards');
            setBoards(response.data.data);
        } catch (error) {
            console.error('게시판 목록 조회 실패:', error);
        }
    };

    const handleSearch = async (page = 1) => {
        const searchKeyword = debouncedKeyword || keyword;
        
        if (!searchKeyword.trim()) {
            return;
        }

        setLoading(true);

        try {
            const params = {
                keyword: searchKeyword.trim(),
                page,
                limit: 20,
                ...filters
            };

            // 빈 필터 제거
            Object.keys(params).forEach(key => {
                if (params[key] === '') delete params[key];
            });

            const response = await api.get('/search/posts', { params });
            
            setResults(response.data.data.posts);
            setPagination(response.data.data.pagination);
        } catch (error) {
            console.error('검색 실패:', error);
            toast.error('검색에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const highlightKeyword = (text) => {
        if (!keyword || !text) return text;
        
        const regex = new RegExp(`(${keyword})`, 'gi');
        const parts = text.split(regex);
        
        return parts.map((part, index) =>
            regex.test(part) ? (
                <mark key={index} className="highlight">{part}</mark>
            ) : (
                part
            )
        );
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\. /g, '.').replace(/\.$/, '');
    };

    const resetFilters = () => {
        setFilters({
            board_id: '',
            category: '',
            author: '',
            start_date: '',
            end_date: ''
        });
    };

    return (
        <div className="search-page">
            {/* 검색 헤더 */}
            <div className="search-header">
                <h1><IconSearch size={20} style={{marginRight:8,verticalAlign:'middle'}}/> 통합 검색</h1>
                <div className="search-input-container">
                    <input
                        type="text"
                        className="search-input-large"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="검색어를 입력하세요..."
                    />
                    <button 
                        className="search-button"
                        onClick={() => handleSearch()}
                        disabled={loading}
                    >
                        {loading ? '검색 중...' : '검색'}
                    </button>
                </div>
            </div>

            {/* 필터 영역 */}
            <div className="search-filters">
                <div className="filter-group">
                    <label>게시판</label>
                    <select
                        value={filters.board_id}
                        onChange={(e) => setFilters({ ...filters, board_id: e.target.value })}
                    >
                        <option value="">전체</option>
                        {boards.map(board => (
                            <option key={board.id} value={board.id}>
                                {board.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>카테고리</label>
                    <select
                        value={filters.category}
                        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    >
                        <option value="">전체</option>
                        <option value="공지">공지</option>
                        <option value="일반">일반</option>
                        <option value="질문">질문</option>
                        <option value="정보">정보</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>작성자</label>
                    <input
                        type="text"
                        value={filters.author}
                        onChange={(e) => setFilters({ ...filters, author: e.target.value })}
                        placeholder="작성자명"
                    />
                </div>

                <div className="filter-group">
                    <label>시작일</label>
                    <input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                    />
                </div>

                <div className="filter-group">
                    <label>종료일</label>
                    <input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                    />
                </div>

                <div className="filter-actions">
                    <button className="apply-filter-btn" onClick={() => handleSearch()}>
                        필터 적용
                    </button>
                    <button className="reset-filter-btn" onClick={resetFilters}>
                        초기화
                    </button>
                </div>
            </div>

            {/* 검색 결과 */}
            <div className="search-results">
                {results.length > 0 ? (
                    <>
                        <div className="results-header">
                            <p className="results-count">
                                총 <strong>{pagination.total}</strong>개의 검색 결과
                            </p>
                        </div>

                        <div className="results-list">
                            {results.map((post) => (
                                <div 
                                    key={post.id}
                                    className="result-item"
                                    onClick={() => navigate(`/boards/${post.board_id}/posts/${post.id}`)}
                                >
                                    <div className="result-header">
                                        <span className="result-board">[{post.board_name}]</span>
                                        {post.category && (
                                            <span className="result-category">{post.category}</span>
                                        )}
                                    </div>
                                    <h3 className="result-title">
                                        {highlightKeyword(post.title)}
                                    </h3>
                                    <p className="result-content">
                                        {highlightKeyword(
                                            post.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...'
                                        )}
                                    </p>
                                    <div className="result-meta">
                                        <span className="meta-author">{post.author_name}</span>
                                        <span className="meta-date">{formatDate(post.created_at)}</span>
                                        <span className="meta-views">조회 {post.view_count}</span>
                                        {post.comment_count > 0 && (
                                            <span className="meta-comments">댓글 {post.comment_count}</span>
                                        )}
                                        {post.attachment_count > 0 && (
                                            <span className="meta-attachments"><IconPaperclip size={12} style={{marginRight:2,verticalAlign:'middle'}}/> {post.attachment_count}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 페이지네이션 */}
                        {pagination.totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    disabled={pagination.page === 1}
                                    onClick={() => handleSearch(pagination.page - 1)}
                                >
                                    이전
                                </button>
                                <span className="page-info">
                                    {pagination.page} / {pagination.totalPages}
                                </span>
                                <button
                                    disabled={pagination.page === pagination.totalPages}
                                    onClick={() => handleSearch(pagination.page + 1)}
                                >
                                    다음
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    !loading && keyword && (
                        <div className="no-results">
                            <p>검색 결과가 없습니다.</p>
                        </div>
                    )
                )}

                {loading && (
                    <div className="page-loading">
                        <div className="spinner"></div>
                        <p>검색 중...</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Search;
