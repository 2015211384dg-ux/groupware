import React, { useState, useEffect, useRef, useCallback } from 'react';
import './FeedTab.css';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/Confirm';

// ── 아이콘 ──────────────────────────────────────────────────
const Ic = ({ d, size = 16, sw = 1.8, fill = 'none', color = 'currentColor', style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
         strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
        {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
);
const IcText     = (p) => <Ic {...p} d={["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z","M14 2v6h6","M16 13H8","M16 17H8","M10 9H8"]} />;
const IcCheck    = (p) => <Ic {...p} d={["M9 11l3 3L22 4","M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"]} />;
const IcCalendar = (p) => <Ic {...p} d={["M8 2v4M16 2v4M3 10h18","M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"]} />;
const IcPoll     = (p) => <Ic {...p} d={["M18 20V10","M12 20V4","M6 20v-6"]} />;
const IcPaperclip= (p) => <Ic {...p} d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />;
const IcSend     = (p) => <Ic {...p} d={["M22 2L11 13","M22 2l-7 20-4-9-9-4 20-7"]} />;
const IcPin      = (p) => <Ic {...p} d={["M12 17v5","M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V7a1 1 0 011-1 2 2 0 000-4H8a2 2 0 000 4 1 1 0 011 1v3.76z"]} />;
const IcEdit     = (p) => <Ic {...p} d={["M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7","M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"]} />;
const IcTrash    = (p) => <Ic {...p} d={["M3 6h18","M8 6V4h8v2","M19 6l-1 14H6L5 6"]} />;
const IcComment  = (p) => <Ic {...p} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />;
const IcX        = (p) => <Ic {...p} d={["M18 6L6 18","M6 6l12 12"]} />;
const IcPlus     = (p) => <Ic {...p} d={["M12 5v14","M5 12h14"]} />;
const IcChevron  = (p) => <Ic {...p} d="M6 9l6 6 6-6" />;
const IcFile     = (p) => <Ic {...p} d={["M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z","M13 2v7h7"]} />;
const IcLocation = (p) => <Ic {...p} d={["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z","M12 10m-3 0a3 3 0 106 0 3 3 0 00-6 0"]} />;

const POST_TYPES = [
    { key: 'text',     label: '글',    Icon: IcText     },
    { key: 'todo',     label: '할 일', Icon: IcCheck    },
    { key: 'schedule', label: '일정',  Icon: IcCalendar },
    { key: 'poll',     label: '투표',  Icon: IcPoll     },
];

const TYPE_COLOR = { text:'#667eea', todo:'#10b981', schedule:'#f59e0b', poll:'#8b5cf6' };

function formatBytes(b) {
    if (!b) return '';
    if (b < 1024) return `${b}B`;
    if (b < 1024 * 1024) return `${(b/1024).toFixed(1)}KB`;
    return `${(b/1024/1024).toFixed(1)}MB`;
}
function timeAgo(d) {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return '방금 전';
    if (s < 3600) return `${Math.floor(s/60)}분 전`;
    if (s < 86400) return `${Math.floor(s/3600)}시간 전`;
    return new Date(d).toLocaleDateString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function isImage(mime) { return mime?.startsWith('image/'); }

// ─────────────────────────────────────────────────────────────
// 작성 폼
// ─────────────────────────────────────────────────────────────
function FeedComposer({ projectId, canWrite, onPosted }) {
    const toast   = useToast();
    const fileRef = useRef(null);
    const [type, setType]       = useState('text');
    const [title, setTitle]     = useState('');
    const [content, setContent] = useState('');
    const [files, setFiles]     = useState([]);
    const [posting, setPosting] = useState(false);
    const [todos, setTodos]     = useState(['']);
    const [schedule, setSchedule] = useState({ start_at:'', end_at:'', location:'', all_day:false });
    const [pollOpts, setPollOpts] = useState(['','']);
    const [pollMeta, setPollMeta] = useState({ anonymous:false, multiple:false, deadline:'' });

    const reset = () => {
        setTitle(''); setContent(''); setFiles([]);
        setTodos(['']);
        setSchedule({ start_at:'', end_at:'', location:'', all_day:false });
        setPollOpts(['','']);
        setPollMeta({ anonymous:false, multiple:false, deadline:'' });
    };

    const handleFile = (e) => {
        const sel = Array.from(e.target.files || []);
        setFiles(prev => [...prev, ...sel].slice(0, 5));
        e.target.value = '';
    };

    const handleSubmit = async () => {
        if (type === 'text' && !content.trim() && !files.length) { toast.warning('내용을 입력해주세요.'); return; }
        if (type !== 'text' && !title.trim()) { toast.warning('제목을 입력해주세요.'); return; }
        if (type === 'todo' && todos.filter(t => t.trim()).length === 0) { toast.warning('항목을 입력해주세요.'); return; }
        if (type === 'poll' && pollOpts.filter(o => o.trim()).length < 2) { toast.warning('투표 항목을 2개 이상 입력해주세요.'); return; }

        setPosting(true);
        try {
            const form = new FormData();
            form.append('post_type', type);
            if (title.trim()) form.append('title', title.trim());
            if (content.trim()) form.append('content', content.trim());
            files.forEach(f => form.append('files', f));
            if (type === 'todo') form.append('todo_items', JSON.stringify(todos.filter(t => t.trim())));
            if (type === 'schedule') form.append('post_meta', JSON.stringify(schedule));
            if (type === 'poll') {
                form.append('poll_options', JSON.stringify(pollOpts.filter(o => o.trim())));
                form.append('post_meta', JSON.stringify(pollMeta));
            }

            const res = await api.post(`/projects/${projectId}/feed`, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onPosted(res.data.feed);
            reset();
        } catch (err) {
            toast.error(err.response?.data?.message || '등록 실패');
        } finally { setPosting(false); }
    };

    if (!canWrite) return null;

    return (
        <div className="fc-composer">
            <div className="fc-type-tabs">
                {POST_TYPES.map(({ key, label, Icon }) => (
                    <button key={key}
                        className={`fc-type-tab ${type === key ? 'active' : ''}`}
                        style={type === key ? { color: TYPE_COLOR[key], borderBottomColor: TYPE_COLOR[key] } : {}}
                        onClick={() => { setType(key); reset(); }}>
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            <div className="fc-form-body">
                {type !== 'text' && (
                    <input className="fc-title-input" placeholder="제목을 입력하세요"
                        value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
                )}

                {(type === 'text' || type === 'schedule') && (
                    <textarea className="fc-content-textarea"
                        placeholder={type === 'text' ? '내용을 입력하세요' : '메모 (선택)'}
                        value={content} onChange={e => setContent(e.target.value)}
                        rows={type === 'text' ? 4 : 2} />
                )}

                {type === 'todo' && (
                    <div className="fc-todo-list">
                        {todos.map((t, i) => (
                            <div key={i} className="fc-todo-row">
                                <span className="fc-todo-check-icon" />
                                <input className="fc-todo-input" placeholder={`할 일 ${i+1}`}
                                    value={t} maxLength={100}
                                    onChange={e => setTodos(prev => prev.map((v,j) => j===i ? e.target.value : v))}
                                    onKeyDown={e => { if (e.key==='Enter' && i===todos.length-1) { e.preventDefault(); setTodos(prev=>[...prev,'']); }}} />
                                {todos.length > 1 && (
                                    <button className="fc-todo-del" onClick={() => setTodos(prev => prev.filter((_,j)=>j!==i))}>
                                        <IcX size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button className="fc-add-item-btn" onClick={() => setTodos(prev=>[...prev,''])}>
                            <IcPlus size={13} /> 항목 추가
                        </button>
                    </div>
                )}

                {type === 'schedule' && (
                    <div className="fc-schedule-fields">
                        <div className="fc-sched-row">
                            <IcCalendar size={15} />
                            <input type="datetime-local" className="fc-sched-input"
                                value={schedule.start_at} onChange={e => setSchedule(s=>({...s,start_at:e.target.value}))} />
                            <span className="fc-sched-sep">—</span>
                            <input type="datetime-local" className="fc-sched-input"
                                value={schedule.end_at} onChange={e => setSchedule(s=>({...s,end_at:e.target.value}))} />
                        </div>
                        <div className="fc-sched-row">
                            <IcLocation size={15} />
                            <input className="fc-sched-text" placeholder="장소 (선택)"
                                value={schedule.location} maxLength={100}
                                onChange={e => setSchedule(s=>({...s,location:e.target.value}))} />
                        </div>
                    </div>
                )}

                {type === 'poll' && (
                    <div className="fc-poll-wrap">
                        <div className="fc-poll-opts">
                            {pollOpts.map((o, i) => (
                                <div key={i} className="fc-poll-opt-row">
                                    <span className="fc-poll-opt-num">{i+1}</span>
                                    <input className="fc-poll-opt-input" placeholder={`항목 ${i+1}`}
                                        value={o} maxLength={100}
                                        onChange={e => setPollOpts(prev=>prev.map((v,j)=>j===i?e.target.value:v))} />
                                    {pollOpts.length > 2 && (
                                        <button className="fc-todo-del" onClick={() => setPollOpts(prev=>prev.filter((_,j)=>j!==i))}>
                                            <IcX size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button className="fc-add-item-btn" onClick={() => setPollOpts(prev=>[...prev,''])}>
                                <IcPlus size={13} /> 항목 추가
                            </button>
                        </div>
                        <div className="fc-poll-settings">
                            <label className="fc-poll-check">
                                <input type="checkbox" checked={pollMeta.multiple}
                                    onChange={e => setPollMeta(m=>({...m,multiple:e.target.checked}))} />복수 선택
                            </label>
                            <label className="fc-poll-check">
                                <input type="checkbox" checked={pollMeta.anonymous}
                                    onChange={e => setPollMeta(m=>({...m,anonymous:e.target.checked}))} />익명 투표
                            </label>
                            <label className="fc-poll-check">
                                마감일
                                <input type="date" className="fc-sched-input" value={pollMeta.deadline}
                                    onChange={e => setPollMeta(m=>({...m,deadline:e.target.value}))} />
                            </label>
                        </div>
                    </div>
                )}

                {type === 'text' && files.length > 0 && (
                    <div className="fc-file-preview">
                        {files.map((f, i) => (
                            <div key={i} className="fc-file-chip">
                                <IcFile size={12} /><span>{f.name}</span>
                                <button onClick={() => setFiles(prev=>prev.filter((_,j)=>j!==i))}><IcX size={10} /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="fc-footer">
                <div className="fc-footer-left">
                    {type === 'text' && (
                        <>
                            <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={handleFile} />
                            <button className="fc-icon-btn" onClick={() => fileRef.current?.click()} title="파일 첨부">
                                <IcPaperclip size={16} />
                            </button>
                        </>
                    )}
                </div>
                <button className="fc-submit-btn" onClick={handleSubmit} disabled={posting}
                    style={{ background: TYPE_COLOR[type] }}>
                    {posting ? '등록 중...' : <><IcSend size={13} /> 등록</>}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 댓글
// ─────────────────────────────────────────────────────────────
function FeedComments({ feedId, projectId, commentCount, canWrite }) {
    const toast = useToast();
    const [open,     setOpen]     = useState(false);
    const [comments, setComments] = useState([]);
    const [text,     setText]     = useState('');
    const [loading,  setLoading]  = useState(false);
    const [sending,  setSending]  = useState(false);

    const loadComments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/projects/${projectId}/feed/${feedId}/comments`);
            setComments(res.data.comments || []);
        } catch {} finally { setLoading(false); }
    }, [feedId, projectId]);

    const handleToggle = () => {
        if (!open && comments.length === 0) loadComments();
        setOpen(o => !o);
    };

    const handleSend = async (e) => {
        if (e.key && e.key !== 'Enter') return;
        if (e.shiftKey) return;
        if (!text.trim()) return;
        e.preventDefault?.();
        setSending(true);
        try {
            const res = await api.post(`/projects/${projectId}/feed/${feedId}/comments`, { content: text.trim() });
            setComments(prev => [...prev, res.data.comment]);
            setText('');
        } catch { toast.error('댓글 등록 실패'); } finally { setSending(false); }
    };

    return (
        <div className="fc-comments-wrap">
            <button className="fc-comment-toggle" onClick={handleToggle}>
                <IcComment size={13} />
                {(open ? comments.length : commentCount) > 0
                    ? `댓글 ${open ? comments.length : commentCount}`
                    : '댓글'}
                <IcChevron size={12} style={{ transform: open ? 'rotate(180deg)' : '', transition:'transform .2s' }} />
            </button>

            {open && (
                <div className="fc-comment-list">
                    {loading && <div className="fc-comment-loading">불러오는 중...</div>}
                    {comments.map(c => (
                        <div key={c.id} className="fc-comment-item">
                            <div className="fc-avatar fc-avatar-sm">{c.user_name?.[0]}</div>
                            <div className="fc-comment-body">
                                <div className="fc-comment-meta">
                                    <span className="fc-comment-name">{c.user_name}</span>
                                    <span className="fc-comment-time">{timeAgo(c.created_at)}</span>
                                </div>
                                <div className="fc-comment-text">{c.content}</div>
                            </div>
                        </div>
                    ))}
                    {canWrite && (
                        <div className="fc-comment-input-row">
                            <div className="fc-avatar fc-avatar-sm" style={{background:'#94a3b8'}}>나</div>
                            <textarea className="fc-comment-input"
                                placeholder="댓글 입력 (Enter 등록, Shift+Enter 줄바꿈)"
                                value={text} onChange={e => setText(e.target.value)}
                                onKeyDown={handleSend} rows={1} disabled={sending} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 타입별 카드 바디
// ─────────────────────────────────────────────────────────────
function TodoCard({ feed, projectId }) {
    const toast = useToast();
    const [items, setItems] = useState(feed.todo_items || []);
    const done = items.filter(i => i.is_done).length;

    const toggle = async (item) => {
        try {
            await api.patch(`/projects/${projectId}/feed/${feed.id}/todo/${item.id}`);
            setItems(prev => prev.map(it => it.id === item.id ? {...it, is_done: it.is_done ? 0 : 1} : it));
        } catch { toast.error('변경 실패'); }
    };

    return (
        <div className="fc-card-todo">
            <div className="fc-card-todo-progress">
                <div className="fc-card-todo-bar">
                    <div className="fc-card-todo-fill"
                        style={{width: items.length ? `${(done/items.length)*100}%` : '0%'}} />
                </div>
                <span className="fc-card-todo-count">{done}/{items.length} 완료</span>
            </div>
            {items.map(item => (
                <div key={item.id} className={`fc-card-todo-item ${item.is_done ? 'done' : ''}`} onClick={() => toggle(item)}>
                    <div className={`fc-card-todo-chk ${item.is_done ? 'checked' : ''}`}>
                        {item.is_done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span>{item.item_text}</span>
                </div>
            ))}
        </div>
    );
}

function ScheduleCard({ feed }) {
    const m = feed.post_meta || {};
    const fmt = (dt) => {
        if (!dt) return '—';
        return new Date(dt).toLocaleString('ko-KR', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',weekday:'short'});
    };
    return (
        <div className="fc-card-schedule">
            <div className="fc-sched-info-row">
                <IcCalendar size={14} color={TYPE_COLOR.schedule} />
                <span>{fmt(m.start_at)}</span>
                {m.end_at && <><span className="fc-sched-sep-sm">—</span><span>{fmt(m.end_at)}</span></>}
            </div>
            {m.location && (
                <div className="fc-sched-info-row">
                    <IcLocation size={14} color="#94a3b8" />
                    <span>{m.location}</span>
                </div>
            )}
        </div>
    );
}

function PollCard({ feed, projectId }) {
    const toast = useToast();
    const [opts, setOpts] = useState(feed.poll_options || []);
    const m = feed.post_meta || {};
    const total = opts.reduce((s, o) => s + Number(o.vote_count), 0);
    const deadline = m.deadline ? new Date(m.deadline) : null;
    const expired  = deadline && deadline < new Date();

    const vote = async (optId) => {
        if (expired) return;
        try {
            const res = await api.post(`/projects/${projectId}/feed/${feed.id}/vote`, { option_id: optId });
            setOpts(prev => prev.map(o => {
                const u = res.data.options.find(x => x.id === o.id);
                return u ? {...o, vote_count: u.vote_count, my_vote: u.my_vote} : o;
            }));
        } catch { toast.error('투표 실패'); }
    };

    return (
        <div className="fc-card-poll">
            {m.deadline && (
                <div className={`fc-poll-deadline ${expired ? 'expired' : ''}`}>
                    {expired ? '투표 종료' : `${deadline.toLocaleDateString('ko-KR')} 마감`}
                </div>
            )}
            {opts.map(opt => {
                const pct = total > 0 ? Math.round((Number(opt.vote_count) / total) * 100) : 0;
                return (
                    <div key={opt.id}
                        className={`fc-poll-opt ${opt.my_vote ? 'voted' : ''} ${expired ? 'ended' : ''}`}
                        onClick={() => vote(opt.id)}>
                        <div className="fc-poll-opt-bar" style={{width:`${pct}%`}} />
                        <span className="fc-poll-opt-text">{opt.option_text}</span>
                        <span className="fc-poll-opt-pct">{pct}%</span>
                        <span className="fc-poll-opt-cnt">{opt.vote_count}명</span>
                        {opt.my_vote ? <span className="fc-poll-voted-mark">✓</span> : null}
                    </div>
                );
            })}
            <div className="fc-poll-total">총 {total}명 참여</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 피드 카드
// ─────────────────────────────────────────────────────────────
function FeedCard({ feed, projectId, myUserId, myRole, onPinToggle, onDelete }) {
    const toast   = useToast();
    const confirm = useConfirm();
    const [editing, setEditing]       = useState(false);
    const [editContent, setEditContent] = useState(feed.content || '');
    const canManage = ['owner','manager'].includes(myRole) || feed.user_id === myUserId;
    const isManager = ['owner','manager'].includes(myRole);
    const typeColor = TYPE_COLOR[feed.post_type || 'text'];
    const typeLabel = { text:'글', todo:'할 일', schedule:'일정', poll:'투표' }[feed.post_type] || '글';

    const handleUpdate = async () => {
        if (!editContent.trim()) return;
        try {
            await api.patch(`/projects/${projectId}/feed/${feed.id}`, { content: editContent });
            feed.content = editContent;
            setEditing(false);
        } catch { toast.error('수정 실패'); }
    };

    const handleDelete = async () => {
        const ok = await confirm('게시글을 삭제할까요?', { confirmText: '삭제', danger: true });
        if (!ok) return;
        try {
            await api.delete(`/projects/${projectId}/feed/${feed.id}`);
            onDelete(feed.id);
        } catch { toast.error('삭제 실패'); }
    };

    return (
        <div className={`fc-card ${feed.is_pinned ? 'pinned' : ''}`}>
            <div className="fc-card-head">
                <div className="fc-avatar">{feed.user_name?.[0]}</div>
                <div className="fc-card-meta">
                    <span className="fc-card-author">{feed.user_name}</span>
                    {feed.position && <span className="fc-card-pos">{feed.position}</span>}
                    <span className="fc-card-time">{timeAgo(feed.created_at)}</span>
                </div>
                <div className="fc-card-actions">
                    <span className="fc-type-badge">{typeLabel}</span>
                    {feed.is_pinned && <span className="fc-pin-badge"><IcPin size={11} /> 고정</span>}
                    {isManager && (
                        <button className="fc-action-btn" onClick={() => onPinToggle(feed.id, !feed.is_pinned)}
                            title={feed.is_pinned ? '고정 해제' : '상단 고정'}>
                            <IcPin size={13} />
                        </button>
                    )}
                    {canManage && feed.post_type === 'text' && (
                        <button className="fc-action-btn" onClick={() => setEditing(e => !e)}><IcEdit size={13} /></button>
                    )}
                    {canManage && (
                        <button className="fc-action-btn danger" onClick={handleDelete}><IcTrash size={13} /></button>
                    )}
                </div>
            </div>

            {feed.title && <div className="fc-card-title">{feed.title}</div>}

            {feed.post_type === 'todo'     && <TodoCard     feed={feed} projectId={projectId} />}
            {feed.post_type === 'schedule' && <ScheduleCard feed={feed} />}
            {feed.post_type === 'poll'     && <PollCard     feed={feed} projectId={projectId} />}

            {feed.content && !editing && (
                <div className="fc-card-content">{feed.content}</div>
            )}
            {editing && (
                <div className="fc-edit-wrap">
                    <textarea className="fc-edit-textarea" value={editContent}
                        onChange={e => setEditContent(e.target.value)} rows={3} />
                    <div className="fc-edit-btns">
                        <button className="fc-edit-cancel" onClick={() => setEditing(false)}>취소</button>
                        <button className="fc-edit-save"   onClick={handleUpdate}>저장</button>
                    </div>
                </div>
            )}

            {feed.attachments?.length > 0 && (
                <div className="fc-attachments">
                    {feed.attachments.filter(a => isImage(a.mime_type)).length > 0 && (
                        <div className="fc-images">
                            {feed.attachments.filter(a => isImage(a.mime_type)).map(a => {
                                const fname = a.file_path.split(/[\\/]/).pop();
                                return (
                                    <img key={a.id} className="fc-img" src={`/uploads/project-feed/${fname}`}
                                         alt={a.file_name}
                                         onClick={() => window.open(`/uploads/project-feed/${fname}`)} />
                                );
                            })}
                        </div>
                    )}
                    {feed.attachments.filter(a => !isImage(a.mime_type)).map(a => (
                        <div key={a.id} className="fc-file-item">
                            <IcFile size={14} /><span>{a.file_name}</span>
                            <span className="fc-file-size">{formatBytes(a.file_size)}</span>
                        </div>
                    ))}
                </div>
            )}

            <FeedComments feedId={feed.id} projectId={projectId}
                commentCount={Number(feed.comment_count)}
                canWrite={['owner','manager','member'].includes(myRole)} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
export default function FeedTab({ projectId, myUserId, myRole }) {
    const toast = useToast();
    const [feeds, setFeeds]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [page, setPage]       = useState(1);
    const canWrite = ['owner','manager','member'].includes(myRole);

    const fetchFeeds = useCallback(async (pg = 1, append = false) => {
        try {
            setLoading(true);
            const res = await api.get(`/projects/${projectId}/feed?page=${pg}`);
            const list = res.data.feeds || [];
            setFeeds(prev => append ? [...prev, ...list] : list);
            setHasMore(res.data.has_more);
            setPage(pg);
        } catch { toast.error('피드 로드 실패'); }
        finally { setLoading(false); }
    }, [projectId]);

    useEffect(() => { fetchFeeds(1); }, [fetchFeeds]);

    const handlePosted = (feed) => setFeeds(prev => [feed, ...prev]);
    const handleDelete = (id)   => setFeeds(prev => prev.filter(f => f.id !== id));
    const handlePin    = async (id, pin) => {
        try {
            await api.patch(`/projects/${projectId}/feed/${id}/pin`, { is_pinned: pin });
            setFeeds(prev =>
                prev.map(f => f.id === id ? {...f, is_pinned: pin ? 1 : 0} : f)
                    .sort((a,b) => (b.is_pinned||0) - (a.is_pinned||0))
            );
        } catch { toast.error('핀 변경 실패'); }
    };

    const pinnedFeeds  = feeds.filter(f => f.is_pinned);
    const regularFeeds = feeds.filter(f => !f.is_pinned);
    const typeLabel    = { text:'글', todo:'할 일', schedule:'일정', poll:'투표' };

    return (
        <div className="feed-tab-wrap">
            <div className="feed-col">
                {/* 작성 폼 */}
                <FeedComposer projectId={projectId} canWrite={canWrite} onPosted={handlePosted} />

                {/* 고정 게시글 섹션 */}
                {pinnedFeeds.length > 0 && (
                    <div className="feed-pinned-section">
                        {pinnedFeeds.map(f => (
                            <div key={f.id} className="feed-pinned-item">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 17v5M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V7a1 1 0 011-1 2 2 0 000-4H8a2 2 0 000 4 1 1 0 011 1v3.76z"/>
                                </svg>
                                <span className="feed-pinned-title">
                                    {f.title || f.content?.slice(0, 40) || '(내용 없음)'}
                                </span>
                                {f.post_type !== 'text' && (
                                    <span className="feed-pinned-type">
                                        {typeLabel[f.post_type] || f.post_type}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 일반 피드 */}
                <div className="feed-list">
                    {loading && feeds.length === 0 ? (
                        <div className="feed-loading"><div className="page-loader-spinner" /></div>
                    ) : feeds.length === 0 ? (
                        <div className="feed-empty">
                            <IcText size={36} color="#d1d5db" />
                            <p>아직 게시글이 없습니다.</p>
                        </div>
                    ) : regularFeeds.map(f => (
                        <FeedCard key={f.id} feed={f} projectId={projectId}
                            myUserId={myUserId} myRole={myRole}
                            onPinToggle={handlePin} onDelete={handleDelete} />
                    ))}
                    {hasMore && (
                        <button className="feed-load-more" onClick={() => fetchFeeds(page+1, true)} disabled={loading}>
                            {loading ? '로딩 중...' : '더 보기'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
