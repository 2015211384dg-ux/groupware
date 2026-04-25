import React, { useState, useEffect, useRef } from 'react';
import api from '../services/authService';
import './Chatbot.css';

export default function Chatbot() {
  const [sessions, setSessions]           = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [loadingHint, setLoadingHint]     = useState(false);
  const [feedback, setFeedback]           = useState({});  // { [message_id]: 'up'|'down' }
  const [ragStatus, setRagStatus]         = useState('checking');
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  useEffect(() => {
    loadSessions();
    checkHealth();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // textarea 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

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

  async function createSession() {
    try {
      const res = await api.post('/chatbot/sessions');
      const newSession = {
        session_id: res.data.session_id,
        title: null,
        updated_at: new Date().toISOString(),
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
      setMessages([]);
    } catch {}
  }

  async function selectSession(session) {
    if (currentSession?.session_id === session.session_id) return;
    setCurrentSession(session);
    setMessages([]);
    try {
      const res = await api.get(`/chatbot/sessions/${session.session_id}/messages`);
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
    if (!input.trim() || loading || !currentSession) return;

    const text = input.trim();
    setInput('');
    setLoading(true);
    setLoadingHint(false);
    const hintTimer = setTimeout(() => setLoadingHint(true), 15000);

    setMessages(prev => [
      ...prev,
      { role: 'user',      content: text, created_at: new Date().toISOString() },
      { role: 'assistant', content: null, loading: true },
    ]);

    try {
      const res = await api.post(
        `/chatbot/sessions/${currentSession.session_id}/chat`,
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

      // 세션 제목 갱신
      setSessions(prev => prev.map(s =>
        s.session_id === currentSession.session_id
          ? { ...s, title: s.title || text.substring(0, 50), updated_at: new Date().toISOString() }
          : s
      ));
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
    const current = feedback[messageId];
    const next    = current === rating ? null : rating;
    setFeedback(prev => ({ ...prev, [messageId]: next }));
    try {
      if (next) {
        await api.post(`/chatbot/messages/${messageId}/feedback`, { rating: next });
      }
    } catch {
      setFeedback(prev => ({ ...prev, [messageId]: current }));
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  }

  const EXAMPLE_QUESTIONS = [
    '연차 사용 방법이 어떻게 되나요?',
    '경조사 지원금 규정이 궁금합니다.',
    '재택근무 신청은 어떻게 하나요?',
  ];

  return (
    <div className="cb-layout">
      {/* ── 사이드바 ── */}
      <aside className="cb-sidebar">
        <div className="cb-sidebar-header">
          <span className="cb-sidebar-title">AI 규정 도우미</span>
          <button className="cb-new-btn" onClick={createSession}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            새 대화
          </button>
        </div>

        <div className="cb-status" data-status={ragStatus}>
          <span className="cb-status-dot" />
          {ragStatus === 'online'   && 'AI 서비스 정상'}
          {ragStatus === 'offline'  && 'AI 서비스 오프라인'}
          {ragStatus === 'no-docs'  && '문서 미등록'}
          {ragStatus === 'checking' && '상태 확인 중...'}
        </div>

        <div className="cb-session-list">
          {sessions.length === 0 && (
            <p className="cb-session-empty">대화 이력이 없습니다</p>
          )}
          {sessions.map(s => (
            <div
              key={s.session_id}
              className={`cb-session-item ${currentSession?.session_id === s.session_id ? 'active' : ''}`}
              onClick={() => selectSession(s)}
            >
              <span className="cb-session-title">{s.title || '새 대화'}</span>
              <button className="cb-session-del" onClick={e => deleteSession(e, s.session_id)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── 메인 영역 ── */}
      <main className="cb-main">
        {!currentSession ? (
          /* 환영 화면 */
          <div className="cb-welcome">
            <div className="cb-welcome-icon">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="1.4">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2 className="cb-welcome-title">사내 규정 AI 도우미</h2>
            <p className="cb-welcome-desc">
              취업규칙, 복리후생, 보안 정책 등<br />궁금한 사항을 질문해 보세요.
            </p>
            <div className="cb-example-wrap">
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  className="cb-example-chip"
                  onClick={async () => { await createSession(); setInput(q); }}
                >
                  {q}
                </button>
              ))}
            </div>
            <button className="cb-start-btn" onClick={createSession}>대화 시작하기</button>
          </div>
        ) : (
          <>
            {/* 메시지 목록 */}
            <div className="cb-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`cb-msg cb-msg-${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <div className="cb-avatar">AI</div>
                  )}
                  <div className="cb-bubble-wrap">
                    <div className={`cb-bubble ${msg.isError ? 'cb-bubble-error' : ''}`}>
                      {msg.loading ? (
                        <div className="cb-typing-wrap">
                          <div className="cb-typing">
                            <span /><span /><span />
                          </div>
                          {loadingHint && (
                            <span className="cb-typing-hint">문서 검색 및 답변 생성 중...</span>
                          )}
                        </div>
                      ) : (
                        <pre className="cb-text">{msg.content}</pre>
                      )}
                    </div>

                    {/* 출처 */}
                    {msg.sources?.length > 0 && (
                      <div className="cb-sources">
                        <span className="cb-sources-label">출처</span>
                        {msg.sources.map((src, si) => (
                          <div key={si} className="cb-source-row">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span className="cb-source-name">{src.source_name}</span>
                            <span className="cb-source-snippet">{src.snippet}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 피드백 버튼 */}
                    {msg.role === 'assistant' && !msg.loading && !msg.isError && msg.id && (
                      <div className="cb-feedback">
                        <button
                          className={`cb-fb-btn ${feedback[msg.id] === 'up' ? 'cb-fb-active-up' : ''}`}
                          title="도움이 됐어요"
                          onClick={() => sendFeedback(msg.id, 'up')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={feedback[msg.id] === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                          </svg>
                        </button>
                        <button
                          className={`cb-fb-btn ${feedback[msg.id] === 'down' ? 'cb-fb-active-down' : ''}`}
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

            {/* 입력창 */}
            <form className="cb-input-area" onSubmit={sendMessage}>
              <textarea
                ref={textareaRef}
                className="cb-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={ragStatus === 'offline' ? 'AI 서비스 오프라인' : '규정에 대해 질문하세요... (Shift+Enter 줄바꿈)'}
                rows={1}
                disabled={loading || ragStatus === 'offline'}
              />
              <button
                type="submit"
                className="cb-send-btn"
                disabled={loading || !input.trim() || ragStatus === 'offline'}
              >
                {loading ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10">
                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
