import React, { useState, useEffect, useRef, useCallback } from 'react';
import './FileTab.css';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/Confirm';
import {
    IconFolder, IconFolderOpen, IconFile, IconPlus,
    IconTrash, IconX, IconChevronRight
} from '../common/Icons';

const IconDownload = (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
);

const IconUpload = (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
);

function formatBytes(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function formatDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getFileIcon(mime) {
    if (!mime) return '📄';
    if (mime.startsWith('image/')) return '🖼️';
    if (mime.includes('pdf')) return '📕';
    if (mime.includes('word') || mime.includes('document')) return '📝';
    if (mime.includes('excel') || mime.includes('sheet')) return '📊';
    if (mime.includes('powerpoint') || mime.includes('presentation')) return '📋';
    if (mime.includes('zip') || mime.includes('rar')) return '🗜️';
    if (mime.startsWith('video/')) return '🎬';
    if (mime.startsWith('audio/')) return '🎵';
    return '📄';
}

export default function FileTab({ projectId, myRole }) {
    const toast   = useToast();
    const confirm = useConfirm();
    const fileInputRef = useRef(null);

    const [folders, setFolders]     = useState([]);
    const [files, setFiles]         = useState([]);
    const [activeFolderId, setActiveFolderId] = useState(null);
    const [loading, setLoading]     = useState(true);
    const [uploading, setUploading] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolder, setShowNewFolder] = useState(false);
    const newFolderRef = useRef(null);

    const canWrite = ['owner', 'manager', 'member'].includes(myRole);

    const fetchFolders = useCallback(async () => {
        const res = await api.get(`/projects/${projectId}/files/folders`);
        setFolders(res.data.folders || []);
    }, [projectId]);

    const fetchFiles = useCallback(async (folderId) => {
        setLoading(true);
        try {
            const params = folderId ? `?folder_id=${folderId}` : '';
            const res = await api.get(`/projects/${projectId}/files${params}`);
            setFiles(res.data.files || []);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchFolders();
        fetchFiles(null);
    }, [fetchFolders, fetchFiles]);

    useEffect(() => {
        if (showNewFolder) newFolderRef.current?.focus();
    }, [showNewFolder]);

    const handleFolderClick = (folder) => {
        const id = folder ? folder.id : null;
        setActiveFolderId(id);
        fetchFiles(id);
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        try {
            const res = await api.post(`/projects/${projectId}/files/folders`, { name: newFolderName.trim() });
            setFolders(prev => [...prev, res.data.folder]);
            setNewFolderName('');
            setShowNewFolder(false);
        } catch {
            toast.error('폴더 생성 실패');
        }
    };

    const handleDeleteFolder = async (folder, e) => {
        e.stopPropagation();
        const ok = await confirm(`"${folder.name}" 폴더와 안의 파일을 모두 삭제할까요?`, { confirmText: '삭제', danger: true });
        if (!ok) return;
        try {
            await api.delete(`/projects/${projectId}/files/folders/${folder.id}`);
            setFolders(prev => prev.filter(f => f.id !== folder.id));
            if (activeFolderId === folder.id) {
                setActiveFolderId(null);
                fetchFiles(null);
            }
        } catch {
            toast.error('폴더 삭제 실패');
        }
    };

    const handleUpload = async (e) => {
        const selected = Array.from(e.target.files || []);
        if (!selected.length) return;
        setUploading(true);
        try {
            const form = new FormData();
            selected.forEach(f => form.append('files', f));
            if (activeFolderId) form.append('folder_id', activeFolderId);
            const res = await api.post(`/projects/${projectId}/files`, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFiles(prev => [...(res.data.files || []), ...prev]);
            toast.success(`${res.data.files.length}개 파일 업로드 완료`);
        } catch {
            toast.error('업로드 실패');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDeleteFile = async (file) => {
        const ok = await confirm(`"${file.file_name}" 파일을 삭제할까요?`, { confirmText: '삭제', danger: true });
        if (!ok) return;
        try {
            await api.delete(`/projects/${projectId}/files/${file.id}`);
            setFiles(prev => prev.filter(f => f.id !== file.id));
        } catch (err) {
            toast.error(err.response?.data?.message || '파일 삭제 실패');
        }
    };

    const handleDownload = (file) => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const base = api.defaults.baseURL || '';
        const url = `${base}/projects/${projectId}/files/${file.id}/download`;
        const a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', file.file_name);
        // token을 쿼리로 붙여도 되지만, axios interceptor가 있으니 fetch로 처리
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.blob())
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                a.href = blobUrl;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            })
            .catch(() => toast.error('다운로드 실패'));
    };

    const activeFolder = folders.find(f => f.id === activeFolderId) || null;

    return (
        <div className="ft-wrap">
            {/* 사이드바 - 폴더 트리 */}
            <div className="ft-sidebar">
                <div
                    className={`ft-folder-item ${activeFolderId === null ? 'active' : ''}`}
                    onClick={() => handleFolderClick(null)}
                >
                    <IconFolder size={15} />
                    <span>전체 파일</span>
                </div>

                {folders.map(folder => (
                    <div
                        key={folder.id}
                        className={`ft-folder-item ${activeFolderId === folder.id ? 'active' : ''}`}
                        onClick={() => handleFolderClick(folder)}
                    >
                        {activeFolderId === folder.id
                            ? <IconFolderOpen size={15} />
                            : <IconFolder size={15} />}
                        <span className="ft-folder-name">{folder.name}</span>
                        {canWrite && (
                            <button
                                className="ft-folder-del"
                                onClick={(e) => handleDeleteFolder(folder, e)}
                                title="폴더 삭제"
                            >
                                <IconX size={12} />
                            </button>
                        )}
                    </div>
                ))}

                {canWrite && (
                    showNewFolder ? (
                        <form className="ft-new-folder-form" onSubmit={handleCreateFolder}>
                            <input
                                ref={newFolderRef}
                                className="ft-new-folder-input"
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                placeholder="폴더 이름"
                                onBlur={() => { if (!newFolderName.trim()) setShowNewFolder(false); }}
                                onKeyDown={e => { if (e.key === 'Escape') setShowNewFolder(false); }}
                            />
                            <button type="submit" className="ft-new-folder-ok">확인</button>
                        </form>
                    ) : (
                        <button className="ft-add-folder-btn" onClick={() => setShowNewFolder(true)}>
                            <IconPlus size={13} /> 폴더 추가
                        </button>
                    )
                )}
            </div>

            {/* 메인 영역 */}
            <div className="ft-main">
                {/* 헤더 */}
                <div className="ft-header">
                    <div className="ft-breadcrumb">
                        <span
                            className={`ft-bc-item ${!activeFolderId ? 'active' : ''}`}
                            onClick={() => handleFolderClick(null)}
                        >
                            전체 파일
                        </span>
                        {activeFolder && (
                            <>
                                <IconChevronRight size={13} />
                                <span className="ft-bc-item active">{activeFolder.name}</span>
                            </>
                        )}
                    </div>
                    {canWrite && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleUpload}
                            />
                            <button
                                className="ft-upload-btn"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                <IconUpload size={14} />
                                {uploading ? '업로드 중...' : '파일 업로드'}
                            </button>
                        </>
                    )}
                </div>

                {/* 파일 목록 */}
                {loading ? (
                    <div className="ft-empty">불러오는 중...</div>
                ) : files.length === 0 ? (
                    <div className="ft-empty">
                        <IconFile size={36} color="#d1d5db" />
                        <p>파일이 없습니다.</p>
                        {canWrite && (
                            <button className="ft-upload-btn" onClick={() => fileInputRef.current?.click()}>
                                <IconUpload size={14} /> 파일 업로드
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="ft-file-list">
                        <div className="ft-file-header-row">
                            <span>파일명</span>
                            <span>올린 사람</span>
                            <span>크기</span>
                            <span>날짜</span>
                            <span></span>
                        </div>
                        {files.map(file => (
                            <div key={file.id} className="ft-file-row">
                                <div className="ft-file-name">
                                    <span className="ft-file-icon">{getFileIcon(file.mime_type)}</span>
                                    <span className="ft-file-title">{file.file_name}</span>
                                </div>
                                <span className="ft-file-uploader">{file.uploaded_by_name}</span>
                                <span className="ft-file-size">{formatBytes(file.file_size)}</span>
                                <span className="ft-file-date">{formatDate(file.created_at)}</span>
                                <div className="ft-file-actions">
                                    <button
                                        className="ft-file-btn"
                                        onClick={() => handleDownload(file)}
                                        title="다운로드"
                                    >
                                        <IconDownload size={14} />
                                    </button>
                                    {canWrite && (
                                        <button
                                            className="ft-file-btn danger"
                                            onClick={() => handleDeleteFile(file)}
                                            title="삭제"
                                        >
                                            <IconTrash size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
