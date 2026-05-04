import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import './SystemMonitor.css';

// ── 아이콘 ──────────────────────────────────────────────
const Ic = ({ d, size = 16, sw = 1.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
);
const IcRefresh    = p => <Ic {...p} d={["M23 4v6h-6","M1 20v-6h6","M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"]} />;
const IcSearch     = p => <Ic {...p} d={["M21 21l-4.35-4.35","M17 11A6 6 0 105 11a6 6 0 0012 0z"]} />;
const IcChevronL   = p => <Ic {...p} d="M15 18l-6-6 6-6" />;
const IcChevronR   = p => <Ic {...p} d="M9 18l6-6-6-6" />;
const IcArrowDown  = p => <Ic {...p} d={["M12 5v14","M19 12l-7 7-7-7"]} />;
const IcX          = p => <Ic {...p} d={["M18 6L6 18","M6 6l12 12"]} />;

// ── 상수 ────────────────────────────────────────────────
const TYPE_META = {
    error:   { label: '에러',  cls: 'sm-badge--error'   },
    warning: { label: '경고',  cls: 'sm-badge--warning' },
    info:    { label: '정보',  cls: 'sm-badge--info'    },
    success: { label: '성공',  cls: 'sm-badge--success' },
};

const PM2_PROCESS_LABELS = {
    backend:  'Backend',
    frontend: 'Frontend',
    rag:      'RAG',
};

function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const hhmm = d.toTimeString().slice(0, 8);
    if (sameDay) return hhmm;
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hhmm}`;
}

function fmtTimePm2(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function SystemMonitor({ user }) {
    const [source, setSource] = useState('system'); // 'system' | 'pm2'
    const [stats, setStats]   = useState({ today: {}, week: {} });

    // system logs state
    const [logs, setLogs]             = useState([]);
    const [total, setTotal]           = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [sysPage, setSysPage]       = useState(1);
    const [sysFilter, setSysFilter]   = useState({ type: 'error,warning', search: '', from: '', to: '' });
    const [sysLoading, setSysLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    // pm2 state
    const [pm2Lines, setPm2Lines]         = useState([]);
    const [pm2Files, setPm2Files]         = useState([]);
    const [pm2Filter, setPm2Filter]       = useState({
        processes: ['backend'],
        streams:   ['error'],
        lines:     500,
        search:    '',
    });
    const [pm2Loading, setPm2Loading]   = useState(false);
    const pm2BottomRef = useRef(null);
    const [autoScrollPm2, setAutoScrollPm2] = useState(true);

    // ── 데이터 로드 ──────────────────────────────────────
    const fetchStats = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/monitor/stats');
            setStats(data);
        } catch {}
    }, []);

    const fetchSystemLogs = useCallback(async (page = 1, filter = sysFilter) => {
        setSysLoading(true);
        try {
            const params = new URLSearchParams({
                type:  filter.type || 'all',
                page,
                limit: 100,
                ...(filter.search && { search: filter.search }),
                ...(filter.from   && { from:   filter.from }),
                ...(filter.to     && { to:     filter.to }),
            });
            const { data } = await api.get(`/admin/monitor/logs?${params}`);
            setLogs(data.logs);
            setTotal(data.total);
            setTotalPages(data.totalPages);
            setSysPage(data.page);
        } catch {}
        setSysLoading(false);
    }, [sysFilter]);

    const fetchPm2Logs = useCallback(async (filter = pm2Filter) => {
        setPm2Loading(true);
        try {
            const keys = [];
            for (const proc of filter.processes) {
                for (const stream of filter.streams) {
                    keys.push(`${proc}-${stream}`);
                }
            }
            if (!keys.length) { setPm2Lines([]); setPm2Loading(false); return; }
            const params = new URLSearchParams({
                files: keys.join(','),
                lines: filter.lines,
                ...(filter.search && { search: filter.search }),
            });
            const { data } = await api.get(`/admin/monitor/pm2?${params}`);
            setPm2Lines(data.lines);
        } catch {}
        setPm2Loading(false);
    }, [pm2Filter]);

    const fetchPm2Files = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/monitor/pm2/files');
            setPm2Files(data.files);
        } catch {}
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { fetchSystemLogs(1, sysFilter); }, []); // eslint-disable-line
    useEffect(() => {
        if (source === 'pm2') { fetchPm2Logs(pm2Filter); fetchPm2Files(); }
    }, [source]); // eslint-disable-line

    // PM2 자동 스크롤
    useEffect(() => {
        if (autoScrollPm2 && pm2BottomRef.current) {
            pm2BottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [pm2Lines, autoScrollPm2]);

    // ── 시스템 로그 필터 핸들러 ──────────────────────────
    const handleSysTypeToggle = (t) => {
        setSysFilter(f => {
            const types = f.type === 'all' ? [] : f.type.split(',').filter(Boolean);
            const next = types.includes(t) ? types.filter(x => x !== t) : [...types, t];
            const newType = next.length === 0 ? 'all' : next.join(',');
            const newFilter = { ...f, type: newType };
            fetchSystemLogs(1, newFilter);
            setSysPage(1);
            return newFilter;
        });
    };

    const handleSysSearch = (e) => {
        if (e.key === 'Enter') {
            fetchSystemLogs(1, sysFilter);
            setSysPage(1);
        }
    };

    const handleSysDateChange = (key, val) => {
        setSysFilter(f => ({ ...f, [key]: val }));
    };
    const applyDateFilter = () => { fetchSystemLogs(1, sysFilter); setSysPage(1); };

    const handleSysPageChange = (p) => { fetchSystemLogs(p, sysFilter); };

    // ── PM2 필터 핸들러 ──────────────────────────────────
    const togglePm2Process = (proc) => {
        setPm2Filter(f => {
            const next = f.processes.includes(proc)
                ? f.processes.filter(x => x !== proc)
                : [...f.processes, proc];
            return { ...f, processes: next };
        });
    };
    const togglePm2Stream = (stream) => {
        setPm2Filter(f => {
            const next = f.streams.includes(stream)
                ? f.streams.filter(x => x !== stream)
                : [...f.streams, stream];
            return { ...f, streams: next };
        });
    };

    const isErrorLine = (line) => {
        if (line.stream === 'error') return true;
        const t = line.text?.toLowerCase() || '';
        return t.includes('error') || t.includes('uncaught') || t.includes('exception') || t.includes('fatal');
    };
    const isWarnLine = (line) => {
        const t = line.text?.toLowerCase() || '';
        return !isErrorLine(line) && (t.includes('warn') || t.includes('deprecated'));
    };

    if (user?.role !== 'SUPER_ADMIN') {
        return <div className="sm-no-access">슈퍼관리자만 접근할 수 있습니다.</div>;
    }

    const activeTypes = sysFilter.type === 'all' ? [] : sysFilter.type.split(',').filter(Boolean);

    return (
        <div className="sm-container">
            {/* ── 헤더 ── */}
            <div className="sm-header">
                <h1 className="sm-title">시스템 모니터</h1>
                <button className="sm-refresh-btn" onClick={() => { fetchStats(); source === 'system' ? fetchSystemLogs(sysPage, sysFilter) : fetchPm2Logs(pm2Filter); }}>
                    <IcRefresh size={15} /> 새로고침
                </button>
            </div>

            {/* ── 통계 카드 ── */}
            <div className="sm-stats-row">
                {[
                    { label: '오늘 에러',  value: stats.today.error   || 0, cls: 'sm-stat--error'   },
                    { label: '오늘 경고',  value: stats.today.warning  || 0, cls: 'sm-stat--warning' },
                    { label: '오늘 전체',  value: Object.values(stats.today).reduce((s, v) => s + v, 0), cls: '' },
                    { label: '7일 에러',   value: stats.week.error    || 0, cls: 'sm-stat--error'   },
                    { label: '7일 경고',   value: stats.week.warning   || 0, cls: 'sm-stat--warning' },
                ].map(s => (
                    <div key={s.label} className={`sm-stat ${s.cls}`}>
                        <span className="sm-stat-value">{s.value.toLocaleString()}</span>
                        <span className="sm-stat-label">{s.label}</span>
                    </div>
                ))}
            </div>

            {/* ── 소스 탭 ── */}
            <div className="sm-source-tabs">
                <button className={`sm-source-tab ${source === 'system' ? 'active' : ''}`} onClick={() => setSource('system')}>
                    시스템 로그 <span className="sm-source-tab-sub">DB</span>
                </button>
                <button className={`sm-source-tab ${source === 'pm2' ? 'active' : ''}`} onClick={() => setSource('pm2')}>
                    PM2 로그 <span className="sm-source-tab-sub">파일</span>
                </button>
            </div>

            {/* ══════════════ 시스템 로그 ══════════════ */}
            {source === 'system' && (
                <div className="sm-panel">
                    {/* 필터 바 */}
                    <div className="sm-filter-bar">
                        <div className="sm-type-chips">
                            {Object.entries(TYPE_META).map(([t, m]) => (
                                <button
                                    key={t}
                                    className={`sm-type-chip sm-type-chip--${t} ${activeTypes.includes(t) || sysFilter.type === 'all' ? 'active' : ''}`}
                                    onClick={() => handleSysTypeToggle(t)}
                                >
                                    {m.label}
                                    {stats.today[t] > 0 && <span className="sm-chip-count">{stats.today[t]}</span>}
                                </button>
                            ))}
                            <button
                                className={`sm-type-chip ${sysFilter.type === 'all' ? 'active' : ''}`}
                                onClick={() => { setSysFilter(f => ({ ...f, type: 'all' })); fetchSystemLogs(1, { ...sysFilter, type: 'all' }); }}
                            >전체</button>
                        </div>
                        <div className="sm-filter-right">
                            <input type="date" className="sm-date-input" value={sysFilter.from}
                                onChange={e => handleSysDateChange('from', e.target.value)} />
                            <span className="sm-date-sep">~</span>
                            <input type="date" className="sm-date-input" value={sysFilter.to}
                                onChange={e => handleSysDateChange('to', e.target.value)} />
                            <button className="sm-apply-btn" onClick={applyDateFilter}>적용</button>
                            <div className="sm-search-wrap">
                                <IcSearch size={14} />
                                <input
                                    className="sm-search-input"
                                    placeholder="메시지 검색 (Enter)"
                                    value={sysFilter.search}
                                    onChange={e => setSysFilter(f => ({ ...f, search: e.target.value }))}
                                    onKeyDown={handleSysSearch}
                                />
                                {sysFilter.search && (
                                    <button className="sm-search-clear" onClick={() => { setSysFilter(f => ({ ...f, search: '' })); fetchSystemLogs(1, { ...sysFilter, search: '' }); }}>
                                        <IcX size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 결과 요약 */}
                    <div className="sm-result-summary">
                        총 <strong>{total.toLocaleString()}</strong>건
                        {sysLoading && <span className="sm-loading-dot"> 로딩 중...</span>}
                    </div>

                    {/* 테이블 */}
                    <div className="sm-table-wrap">
                        <table className="sm-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 120 }}>시간</th>
                                    <th style={{ width: 70 }}>유형</th>
                                    <th>메시지</th>
                                    <th style={{ width: 90 }}>사용자</th>
                                    <th style={{ width: 110 }}>IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 && !sysLoading && (
                                    <tr><td colSpan={5} className="sm-empty">로그가 없습니다.</td></tr>
                                )}
                                {logs.map(log => (
                                    <React.Fragment key={log.id}>
                                        <tr
                                            className={`sm-tr sm-tr--${log.log_type} ${expandedId === log.id ? 'expanded' : ''}`}
                                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                                        >
                                            <td className="sm-td-time">{fmtTime(log.created_at)}</td>
                                            <td><span className={`sm-badge ${TYPE_META[log.log_type]?.cls}`}>{TYPE_META[log.log_type]?.label || log.log_type}</span></td>
                                            <td className="sm-td-msg">
                                                <span className={expandedId === log.id ? '' : 'sm-msg-truncate'}>
                                                    {log.message}
                                                </span>
                                            </td>
                                            <td className="sm-td-user">{log.user_name || '—'}</td>
                                            <td className="sm-td-ip">{log.ip_address || '—'}</td>
                                        </tr>
                                        {expandedId === log.id && (
                                            <tr className="sm-tr-expanded-detail">
                                                <td colSpan={5}>
                                                    <pre className="sm-msg-full">{log.message}</pre>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                        <div className="sm-pagination">
                            <button disabled={sysPage <= 1} onClick={() => handleSysPageChange(sysPage - 1)}><IcChevronL /></button>
                            <span>{sysPage} / {totalPages}</span>
                            <button disabled={sysPage >= totalPages} onClick={() => handleSysPageChange(sysPage + 1)}><IcChevronR /></button>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════ PM2 로그 ══════════════ */}
            {source === 'pm2' && (
                <div className="sm-panel">
                    {/* 필터 바 */}
                    <div className="sm-filter-bar sm-filter-bar--pm2">
                        <div className="sm-pm2-filter-group">
                            <span className="sm-filter-label">프로세스</span>
                            {Object.entries(PM2_PROCESS_LABELS).map(([key, label]) => (
                                <button
                                    key={key}
                                    className={`sm-pm2-chip ${pm2Filter.processes.includes(key) ? 'active' : ''}`}
                                    onClick={() => togglePm2Process(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="sm-pm2-filter-group">
                            <span className="sm-filter-label">스트림</span>
                            {[['error', 'stderr'], ['out', 'stdout']].map(([key, label]) => (
                                <button
                                    key={key}
                                    className={`sm-pm2-chip ${key === 'error' ? 'sm-pm2-chip--error' : ''} ${pm2Filter.streams.includes(key) ? 'active' : ''}`}
                                    onClick={() => togglePm2Stream(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="sm-pm2-filter-group">
                            <span className="sm-filter-label">라인 수</span>
                            <select className="sm-pm2-select" value={pm2Filter.lines}
                                onChange={e => setPm2Filter(f => ({ ...f, lines: Number(e.target.value) }))}>
                                {[100, 300, 500, 1000, 2000].map(n => <option key={n} value={n}>{n}줄</option>)}
                            </select>
                        </div>
                        <div className="sm-search-wrap">
                            <IcSearch size={14} />
                            <input
                                className="sm-search-input"
                                placeholder="로그 내용 검색"
                                value={pm2Filter.search}
                                onChange={e => setPm2Filter(f => ({ ...f, search: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && fetchPm2Logs(pm2Filter)}
                            />
                        </div>
                        <button className="sm-apply-btn" onClick={() => fetchPm2Logs(pm2Filter)}>
                            {pm2Loading ? '로딩...' : '조회'}
                        </button>
                        <label className="sm-autoscroll-toggle">
                            <input type="checkbox" checked={autoScrollPm2} onChange={e => setAutoScrollPm2(e.target.checked)} />
                            맨 아래로
                        </label>
                    </div>

                    {/* 파일 정보 */}
                    {pm2Files.length > 0 && (
                        <div className="sm-pm2-fileinfo">
                            {pm2Files.filter(f => f.size !== null).map(f => (
                                <span key={f.key} className={`sm-pm2-fileinfo-item ${f.key.endsWith('error') ? 'error' : ''}`}>
                                    {f.key}: {f.size ? (f.size / 1024).toFixed(0) + 'KB' : '—'}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* 터미널 뷰어 */}
                    <div className="sm-terminal">
                        {pm2Lines.length === 0 && !pm2Loading && (
                            <div className="sm-terminal-empty">로그가 없습니다. 조회 버튼을 눌러주세요.</div>
                        )}
                        {pm2Lines.map((line, i) => (
                            <div
                                key={i}
                                className={`sm-log-line ${isErrorLine(line) ? 'sm-log-line--error' : isWarnLine(line) ? 'sm-log-line--warn' : ''}`}
                            >
                                <span className="sm-log-process">[{line.process}/{line.stream}]</span>
                                {line.time && <span className="sm-log-time">{fmtTimePm2(line.time)}</span>}
                                <span className="sm-log-text">{line.text}</span>
                            </div>
                        ))}
                        <div ref={pm2BottomRef} />
                    </div>

                    {pm2Lines.length > 0 && (
                        <div className="sm-pm2-footer">
                            <span>{pm2Lines.length.toLocaleString()}줄 표시됨</span>
                            <button className="sm-scroll-bottom-btn" onClick={() => pm2BottomRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                                <IcArrowDown size={14} /> 맨 아래로
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
