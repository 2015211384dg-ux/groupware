import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import api from '../services/authService';
import './ApprovalWrite.css';
import { IconHR, IconBuilding, IconPen, IconPaperclip, IconFile } from '../components/Icons';
import { useToast } from '../components/Toast';

// ─── 조직도 팝업 ────────────────────────────
function OrgPopup({ onSelect, onClose, excludeIds = [] }) {
    const [depts, setDepts]     = useState([]);
    const [users, setUsers]     = useState([]);
    const [selDept, setSelDept] = useState(null);
    const [search, setSearch]   = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/approval/org').then(res => {
            setDepts(res.data.data.departments);
            setUsers(res.data.data.users);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    // 부서 트리 빌드
    const buildTree = (depts, parentId = null) =>
        depts.filter(d => (d.parent_id || null) === parentId)
             .map(d => ({ ...d, children: buildTree(depts, d.id) }));

    const DeptNode = ({ node, depth = 0 }) => (
        <>
            <div
                className={`ow-dept-node ${selDept?.id === node.id ? 'active' : ''}`}
                style={{ paddingLeft: 12 + depth * 14 }}
                onClick={() => setSelDept(node)}
            >
                <IconHR size={15} style={{flexShrink:0}}/>
                {node.name}
            </div>
            {node.children?.map(c => <DeptNode key={c.id} node={c} depth={depth + 1} />)}
        </>
    );

    const filtered = users.filter(u =>
        (!selDept || u.department_id === selDept.id) &&
        (!search  || u.name.includes(search) || u.dept_name?.includes(search)) &&
        !excludeIds.includes(u.id)
    );

    const tree = buildTree(depts);

    return (
        <>
            <div className="ow-overlay" onClick={onClose} />
            <div className="ow-popup">
                <div className="ow-popup-header">
                    <h3>조직도 검색</h3>
                    <button onClick={onClose}>✕</button>
                </div>
                <div className="ow-popup-body">
                    {/* 좌측 부서 트리 */}
                    <div className="ow-dept-tree">
                        <div
                            className={`ow-dept-node ${!selDept ? 'active' : ''}`}
                            onClick={() => setSelDept(null)}
                        >
                            <IconBuilding size={15}/> 전체
                        </div>
                        {tree.map(n => <DeptNode key={n.id} node={n} />)}
                    </div>
                    {/* 우측 사원 목록 */}
                    <div className="ow-user-panel">
                        <input
                            className="ow-search"
                            placeholder="사원명, 부서명 검색"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <div className="ow-user-list">
                            {loading ? <div className="ow-empty">로딩 중...</div> :
                             filtered.length === 0 ? <div className="ow-empty">결과 없음</div> :
                             filtered.map(u => (
                                <div key={u.id} className="ow-user-item" onClick={() => onSelect(u)}>
                                    <div className="ow-user-avatar">{u.name[0]}</div>
                                    <div className="ow-user-info">
                                        <span className="ow-user-name">{u.name}</span>
                                        <span className="ow-user-meta">{u.dept_name} · {u.position || u.job_title || ''}</span>
                                    </div>
                                    <span className="ow-select-icon">+</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── 동적 폼 필드 렌더러 ─────────────────────
function DynamicField({ field, value, onChange }) {
    const common = {
        value: value || '',
        onChange: e => onChange(field.key, e.target.value),
        required: field.required,
        placeholder: field.label + (field.required ? ' *' : ''),
        className: 'aw-field-input'
    };

    if (field.type === 'textarea')
        return <textarea {...common} rows={3} onChange={e => onChange(field.key, e.target.value)} />;
    if (field.type === 'select')
        return (
            <select {...common} onChange={e => onChange(field.key, e.target.value)}>
                <option value="">선택하세요</option>
                {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        );
    return <input type={field.type || 'text'} {...common} />;
}

// ─── 섹션 그룹 렌더러 ──────────────────────
function GroupedFields({ fields, formData, onChange }) {
    // section 속성이 있으면 그룹핑, 없으면 그냥 나열
    const hasSections = fields.some(f => f.section);

    if (!hasSections) {
        return (
            <>
                {fields.map(f => (
                    <div key={f.key} className="aw-field-group">
                        <label className="aw-label">
                            {f.label}{f.required && <span className="aw-required"> *</span>}
                        </label>
                        <DynamicField field={f} value={formData[f.key]} onChange={onChange} />
                    </div>
                ))}
            </>
        );
    }

    // 섹션 순서 유지하면서 그룹핑
    const sections = [];
    const sectionMap = {};
    fields.forEach(f => {
        const sec = f.section || '기타';
        if (!sectionMap[sec]) {
            sectionMap[sec] = [];
            sections.push(sec);
        }
        sectionMap[sec].push(f);
    });

    return (
        <>
            {sections.map(sec => (
                <div key={sec} className="aw-field-section">
                    <div className="aw-field-section-title">{sec}</div>
                    <div className="aw-field-section-body">
                        {sectionMap[sec].map(f => (
                            <div key={f.key} className="aw-field-group">
                                <label className="aw-label">
                                    {f.label}{f.required && <span className="aw-required"> *</span>}
                                </label>
                                <DynamicField field={f} value={formData[f.key]} onChange={onChange} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </>
    );
}

// ─── 메인 컴포넌트 ───────────────────────────
function ApprovalWrite() {
    const toast = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const templateIdParam = searchParams.get('template');
    const { docId } = useParams();  // /approval/write/edit/:docId

    // 단계: 'template' | 'write'
    const [step, setStep]           = useState(templateIdParam ? 'write' : 'template');
    const [categories, setCategories] = useState([]);
    const [recent, setRecent]       = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [selectedTmpl, setSelectedTmpl] = useState(null);
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);

    // 문서 폼
    const [title, setTitle]         = useState('');
    const [content, setContent]     = useState('');
    const [formData, setFormData]   = useState({});
    const [lines, setLines]         = useState([]); // [{step, type, approver_id, name, dept, position}]
    const [showOrgPopup, setShowOrgPopup] = useState(false);
    const [lineTypeFor, setLineTypeFor]   = useState('APPROVAL'); // 팝업 열릴 때 타입

    const quillRef = useRef(null);
    const fileInputRef = useRef(null);
    const [attachments, setAttachments] = useState([]); // {file, name, size, tempId}
    const [uploadedFiles, setUploadedFiles] = useState([]); // 서버 업로드 완료된 파일

    // 서식 목록 로드
    useEffect(() => {
        api.get('/approval/templates').then(res => {
            setCategories(res.data.data.categories);
            setRecent(res.data.data.recent || []);
            setFavorites(res.data.data.favorites || []);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    // URL 파라미터로 서식 바로 로드
    useEffect(() => {
        if (templateIdParam) {
            api.get(`/approval/templates/${templateIdParam}`).then(res => {
                setSelectedTmpl(res.data.data);
                setStep('write');
            }).catch(console.error);
        }
    }, [templateIdParam]);

    // 편집 모드: 기존 임시저장 문서 로드
    useEffect(() => {
        if (!docId) return;
        api.get(`/approval/documents/${docId}`).then(res => {
            const doc = res.data.data;
            setTitle(doc.title || '');
            setContent(doc.content || '');
            setFormData(doc.form_data || {});
            setLines((doc.lines || []).map(l => ({
                step: l.step,
                type: l.type,
                approver_id: l.approver_id,
                name: l.approver_name,
                dept: l.dept_name,
                position: l.position || l.job_title || ''
            })));
            if (doc.template_id) {
                api.get(`/approval/templates/${doc.template_id}`).then(r => setSelectedTmpl(r.data.data)).catch(()=>{});
            }
            setUploadedFiles(doc.attachments || []);
            setStep('write');
        }).catch(console.error);
    }, [docId]);

    const handleSelectTemplate = useCallback(async (tmpl) => {
        try {
            const res = await api.get(`/approval/templates/${tmpl.id}`);
            setSelectedTmpl(res.data.data);
            setStep('write');
        } catch (e) { toast.error('서식 로드 실패'); }
    }, []);

    const handleFreeWrite = () => {
        setSelectedTmpl(null);
        setStep('write');
    };

    const handleFieldChange = (key, val) => {
        setFormData(prev => ({ ...prev, [key]: val }));
    };

    // 결재선 조작
    const addLine = (user) => {
        if (lines.some(l => l.approver_id === user.id)) {
            toast.warning('이미 결재선에 추가된 사용자입니다.');
            return;
        }
        const newStep = lines.filter(l => l.type === 'APPROVAL' || l.type === 'AGREEMENT').length + 1;
        setLines(prev => [...prev, {
            step: lineTypeFor === 'REFERENCE' ? 99 : newStep,
            type: lineTypeFor,
            approver_id: user.id,
            name: user.name,
            dept: user.dept_name,
            position: user.position || user.job_title || ''
        }]);
        setShowOrgPopup(false);
    };

    const removeLine = (idx) => {
        setLines(prev => {
            const next = prev.filter((_, i) => i !== idx);
            // step 재정렬
            let s = 1;
            return next.map(l => l.type === 'REFERENCE' ? { ...l, step: 99 } : { ...l, step: s++ });
        });
    };

    const openOrgPopup = (type) => {
        setLineTypeFor(type);
        setShowOrgPopup(true);
    };

    // 파일 선택
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        const newFiles = files.map(f => ({
            file: f, name: f.name, size: f.size,
            tempId: Date.now() + Math.random()
        }));
        setAttachments(prev => [...prev, ...newFiles]);
        e.target.value = '';
    };

    const removeAttachment = (tempId) => {
        setAttachments(prev => prev.filter(a => a.tempId !== tempId));
    };

    const removeUploaded = async (attachId) => {
        try {
            await api.delete(`/approval/attachments/${attachId}`);
            setUploadedFiles(prev => prev.filter(f => f.id !== attachId));
        } catch (e) { toast.error('파일 삭제 실패'); }
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + 'KB';
        return (bytes/(1024*1024)).toFixed(1) + 'MB';
    };

    // 저장 (임시 or 상신)
    const handleSave = async (submit = false) => {
        if (!title.trim()) { toast.warning('제목을 입력해주세요.'); return; }
        if (submit && lines.filter(l => l.type !== 'REFERENCE').length === 0) {
            toast.warning('결재자를 1명 이상 설정해주세요.');
            return;
        }
        // 필수 폼 필드 검증
        if (selectedTmpl) {
            for (const f of selectedTmpl.form_fields || []) {
                if (f.required && !formData[f.key]) {
                    toast.warning(`'${f.label}' 항목을 입력해주세요.`);
                    return;
                }
            }
        }

        try {
            setSaving(true);
            const payload = {
                template_id: selectedTmpl?.id || null,
                title,
                content,
                form_data: formData,
                lines: lines.map(l => ({ step: l.step, type: l.type, approver_id: l.approver_id })),
                submit
            };
            let savedDocId = docId;
            if (docId) {
                await api.put(`/approval/documents/${docId}`, payload);
            } else {
                const res = await api.post('/approval/documents', payload);
                savedDocId = res.data.data?.id;
            }

            // 첨부파일 업로드
            if (attachments.length > 0 && savedDocId) {
                const formData = new FormData();
                attachments.forEach(a => formData.append('files', a.file));
                try {
                    await api.post(`/approval/documents/${savedDocId}/attachments`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                } catch (e) { console.error('첨부파일 업로드 실패:', e); }
            }

            if (submit) {
                toast.success('상신이 완료되었습니다.');
                navigate('/approval');
            } else {
                toast.success('임시저장 되었습니다.');
                navigate('/approval?box=draft');
            }
        } catch (e) {
            toast.error(e.response?.data?.message || '저장 실패');
        } finally {
            setSaving(false);
        }
    };

    const toggleFavorite = async (tmplId, e) => {
        e.stopPropagation();
        try {
            const res = await api.post(`/approval/templates/${tmplId}/favorite`);
            const isFav = res.data.data.is_favorite;
            setFavorites(prev => isFav ? [...prev, tmplId] : prev.filter(id => id !== tmplId));
        } catch (e) { console.error(e); }
    };

    const LINE_TYPE_LABEL = { APPROVAL: '결재', AGREEMENT: '합의', REFERENCE: '참조' };
    const LINE_TYPE_COLOR = { APPROVAL: '#667eea', AGREEMENT: '#f6ad55', REFERENCE: '#68d391' };

    const quillModules = {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ size: ['small', false, 'large'] }],
            ['link'],
            ['clean']
        ]
    };

    // ── STEP 1: 서식 선택 ──────────────────
    if (step === 'template') {
        return (
            <div className="aw-page">
                <div className="aw-template-page">
                    <div className="aw-tp-header">
                        <button className="aw-back-btn" onClick={() => navigate('/approval')}>← 결재 홈</button>
                        <h1>문서 작성</h1>
                    </div>

                    {/* 자유 양식 + 최근/즐겨찾기 */}
                    <div className="aw-quick-row">
                        <div className="aw-quick-card free" onClick={handleFreeWrite}>
                            <IconPen size={15}/>
                            <span className="aw-qc-label">자유 양식</span>
                        </div>
                        {recent.slice(0,4).map(t => (
                            <div key={t.id} className="aw-quick-card recent" onClick={() => handleSelectTemplate(t)}>
                                <span className="aw-qc-badge">최근</span>
                                <span className="aw-qc-label">{t.name}</span>
                            </div>
                        ))}
                    </div>

                    {/* 즐겨찾기 서식 */}
                    {favorites.length > 0 && (
                        <div className="aw-fav-section">
                            <div className="aw-section-title">⭐ 즐겨찾는 서식</div>
                            <div className="aw-fav-list">
                                {categories.flatMap(c => c.templates)
                                    .filter(t => favorites.includes(t.id))
                                    .map(t => (
                                        <div key={t.id} className="aw-fav-item" onClick={() => handleSelectTemplate(t)}>
                                            <span>{t.name}</span>
                                            <button className="aw-fav-star active"
                                                onClick={e => toggleFavorite(t.id, e)}>★</button>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {/* 전체 서식 */}
                    <div className="aw-section-title" style={{marginTop:24}}>전체 서식</div>
                    {loading ? <div className="aw-loading">로딩 중...</div> :
                        categories.map(cat => cat.templates.length === 0 ? null : (
                            <div key={cat.id} className="aw-cat-block">
                                <div className="aw-cat-title">{cat.name}</div>
                                <div className="aw-tmpl-grid">
                                    {cat.templates.map(t => (
                                        <div key={t.id} className="aw-tmpl-card" onClick={() => handleSelectTemplate(t)}>
                                            <span className="aw-tmpl-name">{t.name}</span>
                                            {t.description && <span className="aw-tmpl-desc">{t.description}</span>}
                                            <button
                                                className={`aw-star-btn ${favorites.includes(t.id) ? 'active' : ''}`}
                                                onClick={e => toggleFavorite(t.id, e)}
                                            >{favorites.includes(t.id) ? '★' : '☆'}</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    }
                </div>
            </div>
        );
    }

    // ── STEP 2: 문서 작성 ──────────────────
    return (
        <div className="aw-page">
            {showOrgPopup && (
                <OrgPopup
                    onSelect={addLine}
                    onClose={() => setShowOrgPopup(false)}
                    excludeIds={lines.map(l => l.approver_id)}
                />
            )}

            <div className="aw-write-layout">
                {/* 좌측: 문서 폼 */}
                <div className="aw-form-area">
                    <div className="aw-form-header">
                        <button className="aw-back-btn" onClick={() => setStep('template')}>← 서식 선택</button>
                        <h2>{selectedTmpl ? selectedTmpl.name : '일반 품의'}</h2>
                    </div>

                    {/* 제목~첨부파일을 하나의 카드로 묶기 */}
                    <div className="aw-card-group">

                    {/* 결재 규정 */}
                    {selectedTmpl?.regulation && (
                        <div className="aw-regulation-box">
                            <div className="aw-regulation-header">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                결재 규정
                            </div>
                            <pre className="aw-regulation-body">{selectedTmpl.regulation}</pre>
                        </div>
                    )}

                    {/* 제목 */}
                    <div className="aw-section">
                        <div className="aw-field-group">
                            <label className="aw-label">제목 <span className="aw-required">*</span></label>
                            <input
                                className="aw-title-input"
                                type="text"
                                placeholder="제목을 입력하세요."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 서식 동적 필드 */}
                    {selectedTmpl?.form_fields?.length > 0 && (
                        <div className="aw-section">
                            <GroupedFields
                                fields={selectedTmpl.form_fields}
                                formData={formData}
                                onChange={handleFieldChange}
                            />
                        </div>
                    )}

                    {/* 본문 에디터 */}
                    <div className="aw-section">
                        <div className="aw-field-group">
                            <label className="aw-label">내용</label>
                            <div className="aw-editor-wrap">
                                <ReactQuill
                                    ref={quillRef}
                                    value={content}
                                    onChange={setContent}
                                    modules={quillModules}
                                    placeholder="내용을 입력하세요."
                                />
                            </div>
                        </div>
                    </div>

                    {/* 첨부파일 */}
                    <div className="aw-section">
                    <div className="aw-field-group">
                        <label className="aw-label">첨부파일</label>
                        <div className="aw-attach-area">
                            {/* 업로드된 파일 목록 */}
                            {uploadedFiles.map(f => (
                                <div key={f.id} className="aw-attach-item uploaded">
                                    <IconPaperclip size={14}/>
                                    <span className="aw-attach-name">{f.filename}</span>
                                    <span className="aw-attach-size">{formatSize(f.filesize || 0)}</span>
                                    <button className="aw-attach-del" onClick={() => removeUploaded(f.id)}>✕</button>
                                </div>
                            ))}
                            {/* 새로 추가된 파일 목록 */}
                            {attachments.map(a => (
                                <div key={a.tempId} className="aw-attach-item new">
                                    <IconFile size={14}/>
                                    <span className="aw-attach-name">{a.name}</span>
                                    <span className="aw-attach-size">{formatSize(a.size)}</span>
                                    <button className="aw-attach-del" onClick={() => removeAttachment(a.tempId)}>✕</button>
                                </div>
                            ))}
                            <button className="aw-attach-add-btn" onClick={() => fileInputRef.current?.click()}>
                                + 파일 첨부
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                                accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.hwp"
                            />
                        </div>
                    </div>
                    </div>{/* aw-section 끝 */}

                    </div>{/* aw-card-group 끝 */}

                    {/* 하단 버튼 */}
                    <div className="aw-form-footer">
                        <button className="aw-btn-cancel" onClick={() => navigate('/approval')}>취소</button>
                        <button className="aw-btn-draft" onClick={() => handleSave(false)} disabled={saving}>
                            {saving ? '저장 중...' : '임시저장'}
                        </button>
                        <button className="aw-btn-submit" onClick={() => handleSave(true)} disabled={saving}>
                            {saving ? '처리 중...' : '상신'}
                        </button>
                    </div>
                </div>

                {/* 우측: 결재선 패널 */}
                <div className="aw-line-panel">
                    <div className="aw-panel-title">결재선 설정</div>

                    {/* 결재선 목록 */}
                    <div className="aw-line-list">
                        {lines.length === 0 ? (
                            <div className="aw-line-empty">
                                결재자를 추가해주세요.<br/>
                                <small>결재선 없이는 상신이 불가합니다.</small>
                            </div>
                        ) : lines.map((l, idx) => (
                            <div key={idx} className="aw-line-item">
                                <div className="aw-line-step"
                                    style={{ background: LINE_TYPE_COLOR[l.type] + '20', color: LINE_TYPE_COLOR[l.type] }}>
                                    {l.type === 'REFERENCE' ? '참' : l.step}
                                </div>
                                <div className="aw-line-info">
                                    <span className="aw-line-name">{l.name}</span>
                                    <span className="aw-line-meta">{l.dept} {l.position && `· ${l.position}`}</span>
                                    <span className="aw-line-type-badge"
                                        style={{ color: LINE_TYPE_COLOR[l.type] }}>
                                        {LINE_TYPE_LABEL[l.type]}
                                    </span>
                                </div>
                                <button className="aw-line-del" onClick={() => removeLine(idx)}>✕</button>
                            </div>
                        ))}
                    </div>

                    {/* 추가 버튼 */}
                    <div className="aw-line-add-btns">
                        <button className="aw-add-btn approval" onClick={() => openOrgPopup('APPROVAL')}>
                            + 결재
                        </button>
                        <button className="aw-add-btn agreement" onClick={() => openOrgPopup('AGREEMENT')}>
                            + 합의
                        </button>
                        <button className="aw-add-btn reference" onClick={() => openOrgPopup('REFERENCE')}>
                            + 참조
                        </button>
                    </div>

                    <div className="aw-line-guide">
                        <small>• <b>결재</b>: 순차 승인 필요<br/>
                        • <b>합의</b>: 의견 제시<br/>
                        • <b>참조</b>: 열람만</small>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ApprovalWrite;