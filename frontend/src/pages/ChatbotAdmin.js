import React, { useState, useEffect, useRef } from 'react';
import api from '../services/authService';
import { useToast } from '../components/common/Toast';
import './ChatbotAdmin.css';

function fmtSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

const EXT_ICON = {
    pdf:  { color: '#ef4444', label: 'PDF' },
    docx: { color: '#3b82f6', label: 'DOCX' },
    doc:  { color: '#3b82f6', label: 'DOC' },
    txt:  { color: '#6b7280', label: 'TXT' },
};

function DocIcon({ filename }) {
    const ext = filename.split('.').pop().toLowerCase();
    const { color, label } = EXT_ICON[ext] || { color: '#9ca3af', label: ext.toUpperCase() };
    return (
        <span className="cba-ext-badge" style={{ background: color + '18', color }}>
            {label}
        </span>
    );
}

export default function ChatbotAdmin() {
    const [docs, setDocs]           = useState([]);
    const [loading, setLoading]     = useState(true);
    const [uploading, setUploading] = useState(false);
    const [reindexing, setReindexing] = useState(false);
    const [dragOver, setDragOver]   = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const fileRef = useRef();
    const { showToast } = useToast();

    useEffect(() => { fetchDocs(); }, []);

    async function fetchDocs() {
        try {
            const res = await api.get('/chatbot/docs');
            setDocs(res.data);
        } catch {
            showToast('문서 목록을 불러오지 못했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function uploadFiles(files) {
        if (!files.length) return;
        setUploading(true);
        let success = 0, fail = 0;
        for (const file of files) {
            const form = new FormData();
            form.append('file', file);
            try {
                await api.post('/chatbot/docs/upload', form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                success++;
            } catch (err) {
                fail++;
                showToast(err.response?.data?.message || `${file.name} 업로드 실패`, 'error');
            }
        }
        setUploading(false);
        if (success) showToast(`${success}개 파일 업로드 완료. 인덱싱 중...`, 'success');
        if (fail === 0) await fetchDocs();
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await api.delete(`/chatbot/docs/${encodeURIComponent(deleteTarget)}`);
            showToast('삭제 완료. 인덱싱 중...', 'success');
            setDocs(prev => prev.filter(d => d.name !== deleteTarget));
        } catch (err) {
            showToast(err.response?.data?.message || '삭제에 실패했습니다.', 'error');
        } finally {
            setDeleteTarget(null);
        }
    }

    async function handleReindex() {
        setReindexing(true);
        try {
            const res = await api.post('/chatbot/docs/reindex');
            showToast(res.data.message, 'success');
        } catch (err) {
            showToast(err.response?.data?.message || '재인덱싱에 실패했습니다.', 'error');
        } finally {
            setReindexing(false);
        }
    }

    const onDrop = e => {
        e.preventDefault();
        setDragOver(false);
        uploadFiles([...e.dataTransfer.files]);
    };

    return (
        <div className="cba-page">
            {/* 헤더 */}
            <div className="cba-header">
                <div className="cba-header-left">
                    <div className="cba-header-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                    </div>
                    <div>
                        <h1 className="cba-title">AI 챗봇 문서 관리</h1>
                        <p className="cba-subtitle">규정 문서를 업로드하면 자동으로 인덱싱됩니다</p>
                    </div>
                </div>
                <button
                    className={`cba-reindex-btn ${reindexing ? 'loading' : ''}`}
                    onClick={handleReindex}
                    disabled={reindexing || uploading}
                    title="전체 재인덱싱"
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        style={{ animation: reindexing ? 'cba-spin 1s linear infinite' : 'none' }}>
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    {reindexing ? '인덱싱 중...' : '전체 재인덱싱'}
                </button>
            </div>

            {/* 통계 */}
            <div className="cba-stats">
                <div className="cba-stat">
                    <span className="cba-stat-num">{docs.length}</span>
                    <span className="cba-stat-label">등록 문서</span>
                </div>
                <div className="cba-stat">
                    <span className="cba-stat-num">
                        {fmtSize(docs.reduce((s, d) => s + d.size, 0))}
                    </span>
                    <span className="cba-stat-label">전체 크기</span>
                </div>
                <div className="cba-stat">
                    <span className="cba-stat-num">
                        {docs.length
                            ? fmtDate(docs.reduce((a, b) =>
                                new Date(a.modified_at) > new Date(b.modified_at) ? a : b
                              ).modified_at)
                            : '-'}
                    </span>
                    <span className="cba-stat-label">마지막 업데이트</span>
                </div>
            </div>

            {/* 업로드 영역 */}
            <div
                className={`cba-dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !uploading && fileRef.current?.click()}
            >
                <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.txt"
                    style={{ display: 'none' }}
                    onChange={e => uploadFiles([...e.target.files])}
                />
                {uploading ? (
                    <div className="cba-drop-uploading">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2"
                            style={{ animation: 'cba-spin 1s linear infinite' }}>
                            <circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="8"/>
                        </svg>
                        <span>업로드 중...</span>
                    </div>
                ) : (
                    <>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <p className="cba-drop-text">
                            파일을 드래그하거나 <span>클릭하여 업로드</span>
                        </p>
                        <p className="cba-drop-hint">PDF, DOCX, TXT · 최대 50MB</p>
                    </>
                )}
            </div>

            {/* 문서 목록 */}
            <div className="cba-doc-list">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="cba-doc-row skel">
                            <div className="skel" style={{ width: 40, height: 24, borderRadius: 4 }} />
                            <div className="skel" style={{ flex: 1, height: 16, borderRadius: 4 }} />
                            <div className="skel" style={{ width: 80, height: 14, borderRadius: 4 }} />
                        </div>
                    ))
                ) : docs.length === 0 ? (
                    <div className="cba-empty">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <p>등록된 문서가 없습니다</p>
                        <span>위에서 파일을 업로드해 주세요</span>
                    </div>
                ) : docs.map(doc => (
                    <div key={doc.name} className="cba-doc-row">
                        <DocIcon filename={doc.name} />
                        <div className="cba-doc-info">
                            <span className="cba-doc-name">{doc.name}</span>
                            <span className="cba-doc-meta">{fmtSize(doc.size)} · {fmtDate(doc.modified_at)}</span>
                        </div>
                        <button
                            className="cba-del-btn"
                            onClick={() => setDeleteTarget(doc.name)}
                            title="삭제"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14H6L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4h6v2"/>
                            </svg>
                        </button>
                    </div>
                ))}
            </div>

            {/* 삭제 확인 모달 */}
            {deleteTarget && (
                <div className="cba-modal-overlay" onClick={() => setDeleteTarget(null)}>
                    <div className="cba-modal" onClick={e => e.stopPropagation()}>
                        <div className="cba-modal-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14H6L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4h6v2"/>
                            </svg>
                        </div>
                        <h3 className="cba-modal-title">문서 삭제</h3>
                        <p className="cba-modal-desc">
                            <strong>{deleteTarget}</strong>을 삭제하면<br/>
                            인덱스에서도 제거됩니다.
                        </p>
                        <div className="cba-modal-actions">
                            <button className="cba-modal-cancel" onClick={() => setDeleteTarget(null)}>취소</button>
                            <button className="cba-modal-confirm" onClick={handleDelete}>삭제</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
