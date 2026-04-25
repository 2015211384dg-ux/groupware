import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import api from '../services/authService';
import { useToast } from '../components/common/Toast';
import './PostWrite.css';

function PostWrite({ user }) {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const quillRef = useRef(null);
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [category, setCategory] = useState('공지');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN'].includes(user?.role);

  const [selectedFiles, setSelectedFiles] = useState([]); // File[]
  const [uploadedFiles, setUploadedFiles] = useState([]); // {id, original_name, file_path...}[]
  const [attachmentIds, setAttachmentIds] = useState([]); // number[]

  const MAX_TITLE = 200;
  const MAX_FILES = 5;
  const MAX_FILE_MB = 10;

  const modules = useMemo(() => ({
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: [] }],
      ['link', 'image'],
      ['clean'],
    ],
  }), []);

  const formats = useMemo(() => ([
    'header', 'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'align', 'link', 'image',
  ]), []);

  const stripText = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return (div.textContent || div.innerText || '').trim();
  };

  const uploadNow = async (files) => {
    if (uploading) return;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);

      const fd = new FormData();
      files.forEach(f => fd.append('files', f));

      const res = await api.post('/attachments/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res?.data?.success === false) {
        toast.error(res?.data?.message || '파일 업로드 실패');
        return;
      }

      const ids = res?.data?.data?.attachment_ids || [];
      const infos = res?.data?.data?.files || [];

      setAttachmentIds(prev => [...prev, ...ids]);
      setUploadedFiles(prev => [...prev, ...infos]);

    } catch (e) {
      console.error(e);
      toast.error('파일을 업로드하지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const onPickFiles = async (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const trimmed = [];
    for (const f of incoming) {
      if (trimmed.length >= MAX_FILES) break;
      const mb = f.size / (1024 * 1024);
      if (mb > MAX_FILE_MB) {
        toast.warning(`10MB 초과 파일은 업로드할 수 없습니다: ${f.name}`);
        continue;
      }
      trimmed.push(f);
    }

    setSelectedFiles(prev => [...prev, ...trimmed]);
    await uploadNow(trimmed);
  };

  const removeUploaded = (idx) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
    setAttachmentIds(prev => prev.filter((_, i) => i !== idx));
  };

  const submitPost = async () => {
    if (loading) return;

    const t = title.trim();
    const cText = stripText(content);

    if (!boardId) {
      toast.error('boardId가 없습니다.');
      return;
    }
    if (!t) {
      toast.warning('제목을 입력해주세요.');
      return;
    }
    if (!cText) {
      toast.warning('내용을 입력해주세요.');
      return;
    }
    if (uploading) {
      toast.warning('파일 업로드가 진행 중입니다. 완료 후 작성해주세요.');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        board_id: Number(boardId),
        category,
        title: t,
        content,
        is_notice: category === '공지',
        is_pinned: isPinned,
        attachment_ids: attachmentIds,
      };

      const res = await api.post('/posts', payload);

      if (res?.data?.success === false) {
        toast.error(res?.data?.message || '게시글 작성 실패');
        return;
      }

      navigate(`/boards/${boardId}`);
    } catch (e) {
      console.error(e);
      toast.error('게시글 작성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="post-write-page-v2">
      <div className="write-form">
        <div className="title-section">
          <div className="category-selector">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="공지">공지</option>
              <option value="일반">일반</option>
              <option value="업무">업무</option>
            </select>
          </div>

          <input
            className="title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
            placeholder="제목을 입력하세요"
            maxLength={MAX_TITLE}
          />

          <div className="char-count">{title.length}/{MAX_TITLE}</div>
        </div>

        <div className="editor-container">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            placeholder="내용을 입력하세요"
          />
        </div>

        <div className="file-upload-section">
          <div className="file-upload-row">
            <label className="file-pick-btn">
              {uploading ? '업로드 중...' : '파일 선택(즉시 업로드)'}
              <input
                type="file"
                multiple
                onChange={(e) => onPickFiles(e.target.files)}
                style={{ display: 'none' }}
              />
            </label>

            <div className="file-hint">
              최대 {MAX_FILES}개, {MAX_FILE_MB}MB 이하
            </div>

            {isAdmin && (
              <label className="pin-checkbox-label">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                게시글 고정
              </label>
            )}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="uploaded-box">
              <div className="uploaded-title">업로드 완료</div>
              {uploadedFiles.map((u, idx) => (
                <div className="uploaded-item" key={u.id}>
                  <span className="uploaded-name">{u.original_filename}</span>
                  <div className="uploaded-actions">
                    <a className="uploaded-link" href={u.file_path} target="_blank" rel="noreferrer">
                      열기
                    </a>
                    <button
                      type="button"
                      className="uploaded-remove"
                      onClick={() => removeUploaded(idx)}
                    >
                      제외
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={() => navigate(-1)} disabled={loading || uploading}>
            취소
          </button>
          <button type="button" className="submit-btn" onClick={submitPost} disabled={loading || uploading}>
            {loading ? '저장 중...' : '작성 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PostWrite;
