import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/authService';
import './ChatbotWidget.css';

export default function ChatbotWidget() {
  const [open, setOpen]                   = useState(false);
  const [sessions, setSessions]           = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [loadingHint, setLoadingHint]     = useState(false);
  const [feedback, setFeedback]           = useState({});  // { [message_id]: 'up'|'down' }
  const [ragStatus, setRagStatus]         = useState('checking');
  const [view, setView]                   = useState('chat');   // 'chat' | 'sessions'
  const [unread, setUnread]               = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const panelRef       = useRef(null);

  // 드래그 상태
  const [fabPos, setFabPos]   = useState(null); // null = CSS 기본값(우측 하단)
  const isDragging  = useRef(false);
  const hasMoved    = useRef(false);
  const dragStart   = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
      const x = Math.max(0, Math.min(window.innerWidth  - 54, dragStart.current.px + dx));
      const y = Math.max(0, Math.min(window.innerHeight - 54, dragStart.current.py + dy));
      setFabPos({ x, y });
    };
    const onUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // 패널 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setUnread(false);
      checkHealth();
      loadSessions();
    }
  }, [open]);

  // 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // textarea 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [input]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        open &&
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        !e.target.closest('.cbw-fab')
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function checkHealth() {
    try {
      const res = await api.get('/chatbot/health');
      setRagStatus(res.data.chroma_ready ? 'online' : 'no-docs');
    } catch {
      setRagStatus('offline');
    }
  }

  async function loadSessions() {
    try {
      const res = await api.get('/chatbot/sessions');
      setSessions(res.data);
    } catch {}
  }

  const createSession = useCallback(async () => {
    try {
      const res = await api.post('/chatbot/sessions');
      const s = {
        session_id: res.data.session_id,
        title: null,
        updated_at: new Date().toISOString(),
      };
      setSessions(prev => [s, ...prev]);
      setCurrentSession(s);
      setMessages([]);
      setView('chat');
    } catch {}
  }, []);

  async function selectSession(s) {
    setCurrentSession(s);
    setMessages([]);
    setView('chat');
    try {
      const res = await api.get(`/chatbot/sessions/${s.session_id}/messages`);
      setMessages(res.data);
    } catch {}
  }

  async function deleteSession(e, sessionId) {
    e.stopPropagation();
    try {
      await api.delete(`/chatbot/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      if (currentSession?.session_id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch {}
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    // 세션 없으면 자동 생성
    let session = currentSession;
    if (!session) {
      try {
        const res = await api.post('/chatbot/sessions');
        session = {
          session_id: res.data.session_id,
          title: null,
          updated_at: new Date().toISOString(),
        };
        setSessions(prev => [session, ...prev]);
        setCurrentSession(session);
      } catch { return; }
    }

    const text = input.trim();
    setInput('');
    setLoading(true);
    setLoadingHint(false);
    const hintTimer = setTimeout(() => setLoadingHint(true), 15000);

    setMessages(prev => [
      ...prev,
      { role: 'user',      content: text,  created_at: new Date().toISOString() },
      { role: 'assistant', content: null,   loading: true },
    ]);

    try {
      const res = await api.post(
        `/chatbot/sessions/${session.session_id}/chat`,
        { message: text }
      );

      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        {
          id:            res.data.message_id,
          role:          'assistant',
          content:       res.data.answer,
          sources:       res.data.sources,
          found_context: res.data.found_context,
          created_at:    new Date().toISOString(),
        },
      ]);

      setSessions(prev => prev.map(s =>
        s.session_id === session.session_id
          ? { ...s, title: s.title || text.substring(0, 40), updated_at: new Date().toISOString() }
          : s
      ));

      if (!open) setUnread(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'AI 서비스에 연결하지 못했습니다.';
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { role: 'assistant', content: msg, isError: true, created_at: new Date().toISOString() },
      ]);
    } finally {
      clearTimeout(hintTimer);
      setLoading(false);
      setLoadingHint(false);
    }
  }

  async function sendFeedback(messageId, rating) {
    // 같은 버튼 누르면 취소
    const current = feedback[messageId];
    const next    = current === rating ? null : rating;
    setFeedback(prev => ({ ...prev, [messageId]: next }));
    try {
      if (next) {
        await api.post(`/chatbot/messages/${messageId}/feedback`, { rating: next });
      }
    } catch {
      // 실패 시 원래대로
      setFeedback(prev => ({ ...prev, [messageId]: current }));
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  }

  const isOffline = ragStatus === 'offline';

  return (
    <>
      {/* ── 슬라이드 패널 ── */}
      <div ref={panelRef} className={`cbw-panel ${open ? 'cbw-panel-open' : ''}`}>

        {/* 헤더 */}
        <div className="cbw-header">
          <div className="cbw-header-left">
            {view === 'sessions' ? (
              <button className="cbw-icon-btn" onClick={() => setView('chat')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="19" y1="12" x2="5" y2="12"/>
                  <polyline points="12 19 5 12 12 5"/>
                </svg>
              </button>
            ) : (
              <div className="cbw-header-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
            )}
            <div>
              <div className="cbw-header-title">AI 규정 도우미</div>
              <div className="cbw-header-sub" data-status={ragStatus}>
                <span className="cbw-status-dot" />
                {ragStatus === 'online'   && '답변 준비됨'}
                {ragStatus === 'offline'  && '서비스 오프라인'}
                {ragStatus === 'no-docs'  && '문서 미등록'}
                {ragStatus === 'checking' && '연결 중...'}
              </div>
            </div>
          </div>
          <div className="cbw-header-actions">
            <button
              className="cbw-icon-btn"
              title="대화 이력"
              onClick={() => setView(v => v === 'sessions' ? 'chat' : 'sessions')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
            <button className="cbw-icon-btn" title="새 대화" onClick={createSession}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button className="cbw-icon-btn" onClick={() => setOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── 세션 목록 뷰 ── */}
        {view === 'sessions' && (
          <div className="cbw-sessions">
            <button className="cbw-new-session-btn" onClick={createSession}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              새 대화 시작
            </button>
            {sessions.length === 0 && (
              <p className="cbw-sessions-empty">대화 이력이 없습니다</p>
            )}
            {sessions.map(s => (
              <div
                key={s.session_id}
                className={`cbw-session-item ${currentSession?.session_id === s.session_id ? 'active' : ''}`}
                onClick={() => selectSession(s)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span className="cbw-session-title">{s.title || '새 대화'}</span>
                <button
                  className="cbw-session-del"
                  onClick={e => deleteSession(e, s.session_id)}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── 채팅 뷰 ── */}
        {view === 'chat' && (
          <>
            {/* 메시지 없을 때 환영 화면 */}
            {messages.length === 0 && (
              <div className="cbw-welcome">
                <div className="cbw-welcome-icon">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <p className="cbw-welcome-title">무엇이 궁금하신가요?</p>
                <p className="cbw-welcome-desc">취업규칙, 복리후생, 보안 정책 등<br/>사내 규정을 질문해 보세요.</p>
                <div className="cbw-examples">
                  {['연차 사용 방법', '경조사 지원금 규정', '재택근무 신청 방법'].map(q => (
                    <button
                      key={q}
                      className="cbw-example"
                      onClick={() => setInput(q)}
                      disabled={isOffline}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 메시지 목록 */}
            {messages.length > 0 && (
              <div className="cbw-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`cbw-msg cbw-msg-${msg.role}`}>
                    {msg.role === 'assistant' && (
                      <div className="cbw-avatar">AI</div>
                    )}
                    <div className="cbw-bubble-wrap">
                      <div className={`cbw-bubble ${msg.isError ? 'cbw-bubble-error' : ''}`}>
                        {msg.loading ? (
                          <div className="cbw-typing-wrap">
                            <div className="cbw-typing">
                              <span /><span /><span />
                            </div>
                            {loadingHint && (
                              <span className="cbw-typing-hint">문서 검색 및 답변 생성 중...</span>
                            )}
                          </div>
                        ) : (
                          <pre className="cbw-text">{msg.content}</pre>
                        )}
                      </div>
                      {msg.sources?.length > 0 && (
                        <div className="cbw-sources">
                          {msg.sources.map((src, si) => (
                            <div key={si} className="cbw-source-row">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span className="cbw-source-name">{src.source_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* 피드백 버튼 — 로딩 아닌 어시스턴트 메시지에만 */}
                      {msg.role === 'assistant' && !msg.loading && !msg.isError && msg.id && (
                        <div className="cbw-feedback">
                          <button
                            className={`cbw-fb-btn ${feedback[msg.id] === 'up' ? 'cbw-fb-active-up' : ''}`}
                            title="도움이 됐어요"
                            onClick={() => sendFeedback(msg.id, 'up')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={feedback[msg.id] === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                            </svg>
                          </button>
                          <button
                            className={`cbw-fb-btn ${feedback[msg.id] === 'down' ? 'cbw-fb-active-down' : ''}`}
                            title="도움이 안 됐어요"
                            onClick={() => sendFeedback(msg.id, 'down')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={feedback[msg.id] === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                              <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* 입력창 */}
            <form className="cbw-input-area" onSubmit={sendMessage}>
              <textarea
                ref={textareaRef}
                className="cbw-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isOffline ? 'AI 서비스 오프라인' : '규정에 대해 질문하세요...'}
                rows={1}
                disabled={loading || isOffline}
              />
              <button
                type="submit"
                className="cbw-send-btn"
                disabled={loading || !input.trim() || isOffline}
              >
                {loading ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="8">
                      <animateTransform attributeName="transform" type="rotate"
                        from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </form>
          </>
        )}
      </div>

      {/* ── 플로팅 버튼 ── */}
      <button
        className={`cbw-fab ${open ? 'cbw-fab-open' : ''}`}
        style={fabPos ? { left: fabPos.x, top: fabPos.y, bottom: 'auto', right: 'auto', cursor: 'grab' } : { cursor: 'grab' }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          const pos = fabPos ?? { x: window.innerWidth - 82, y: window.innerHeight - 82 };
          isDragging.current = true;
          hasMoved.current = false;
          dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
          e.preventDefault();
        }}
        onClick={() => { if (!hasMoved.current) setOpen(prev => !prev); }}
        title="AI 규정 도우미"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {unread && <span className="cbw-fab-badge" />}
          </>
        )}
      </button>
    </>
  );
}
