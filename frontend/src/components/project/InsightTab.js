import React, { useState, useEffect, useCallback } from 'react';
import './InsightTab.css';
import api from '../../services/api';

// ── 아이콘 ──
const Ic = ({ d, size=18, sw=1.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {Array.isArray(d) ? d.map((p,i)=><path key={i} d={p}/>) : <path d={d}/>}
    </svg>
);
const IcPlus   = p => <Ic {...p} d={["M12 5v14","M5 12h14"]} />;
const IcX      = p => <Ic {...p} d={["M18 6L6 18","M6 6l12 12"]} />;
const IcBar    = p => <Ic {...p} d={["M18 20V10","M12 20V4","M6 20v-6"]} />;
const IcDonut  = p => <Ic {...p} d="M12 22a10 10 0 100-20 10 10 0 000 20z" />;
const IcTrend  = p => <Ic {...p} d={["M22 12h-4l-3 9L9 3l-3 9H2"]} />;
const IcGroup  = p => <Ic {...p} d={["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2","M9 11a4 4 0 100-8 4 4 0 000 8z","M23 21v-2a4 4 0 00-3-3.87","M16 3.13a4 4 0 010 7.75"]} />;
const IcCard   = p => <Ic {...p} d={["M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z","M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"]} />;
const IcLog    = p => <Ic {...p} d={["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z","M14 2v6h6","M16 13H8","M16 17H8"]} />;

const STATUS_COLOR  = { done:'#10b981', in_progress:'#667eea', todo:'#94a3b8', on_hold:'#f59e0b' };
const STATUS_KO     = { done:'완료', in_progress:'진행 중', todo:'할 일', on_hold:'보류' };
const PRIORITY_COLOR= { urgent:'#ef4444', high:'#f97316', normal:'#667eea', low:'#94a3b8' };
const PRIORITY_KO   = { urgent:'긴급', high:'높음', normal:'보통', low:'낮음' };

// ── 위젯 카탈로그 ──────────────────────────────────────────
const WIDGET_CATALOG = [
    { id:'summary',       icon: IcCard,  label:'요약 카드',       desc:'전체·완료·진행중·평균진행률 수치 요약' },
    { id:'status_donut',  icon: IcDonut, label:'상태 분포',       desc:'업무 상태별 비율을 도넛 차트로 표시' },
    { id:'priority_bar',  icon: IcBar,   label:'우선순위 분포',   desc:'긴급/높음/보통/낮음 업무 수 비교' },
    { id:'group_progress',icon: IcGroup, label:'그룹별 진행률',   desc:'각 그룹의 완료 비율을 바 차트로 표시' },
    { id:'weekly_trend',  icon: IcTrend, label:'14일 활동 추이',  desc:'최근 2주간 활동 건수 스파크라인' },
    { id:'assignee_tasks',icon: IcBar,   label:'담당자별 업무',   desc:'멤버별 담당 업무 건수 분포' },
    { id:'activity_log',  icon: IcLog,   label:'활동 로그',       desc:'최근 프로젝트 활동 타임라인' },
];

// ── 도넛 차트 ──────────────────────────────────────────────
function DonutChart({ data, size=130 }) {
    const cx = size/2, cy = size/2, r = size*0.36;
    const total = data.reduce((s,d) => s + d.value, 0);
    if (!total) return (
        <svg width={size} height={size}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size*0.16}/>
            <text x={cx} y={cy+5} textAnchor="middle" fontSize={size*0.12} fill="#94a3b8">없음</text>
        </svg>
    );
    const circ = 2*Math.PI*r;
    let off = 0;
    const slices = data.map(d => {
        const dash = (d.value/total)*circ;
        const s = { ...d, dash, gap: circ-dash, offset: off };
        off += dash; return s;
    });
    return (
        <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
            {slices.map((s,i) => (
                <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
                    strokeWidth={size*0.16} strokeDasharray={`${s.dash} ${s.gap}`}
                    strokeDashoffset={-s.offset} strokeLinecap="butt"/>
            ))}
            <text x={cx} y={cy+5} textAnchor="middle" fontSize={size*0.18} fontWeight="700" fill="#1a1a2e"
                style={{transform:`rotate(90deg)`,transformOrigin:`${cx}px ${cy}px`}}>{total}</text>
            <text x={cx} y={cy+size*0.14} textAnchor="middle" fontSize={size*0.1} fill="#94a3b8"
                style={{transform:`rotate(90deg)`,transformOrigin:`${cx}px ${cy}px`}}>업무</text>
        </svg>
    );
}

// ── 스파크라인 ─────────────────────────────────────────────
function Sparkline({ data }) {
    const days = 14;
    const today = new Date();
    const grid = Array.from({length:days}, (_,i) => {
        const d = new Date(today); d.setDate(today.getDate()-(days-1-i));
        const key = d.toISOString().slice(0,10);
        const found = data.find(r => r.day === key);
        return { date:d, key, cnt: found ? Number(found.cnt) : 0 };
    });
    const maxCnt = Math.max(...grid.map(g=>g.cnt), 1);
    const W=340, H=56, bw=W/days-3;
    return (
        <div className="ins-sparkline-wrap">
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                {grid.map((g,i) => {
                    const bh = Math.max((g.cnt/maxCnt)*(H-6), g.cnt>0?4:1);
                    return (
                        <rect key={g.key} x={i*(W/days)+1.5} y={H-bh} width={bw} height={bh} rx={3}
                            fill={g.cnt>0?'#667eea':'#e5e7eb'} opacity={g.cnt>0?0.8:1}>
                            {g.cnt>0 && <title>{g.date.toLocaleDateString('ko-KR',{month:'short',day:'numeric'})}: {g.cnt}건</title>}
                        </rect>
                    );
                })}
            </svg>
            <div className="ins-sparkline-labels">
                <span>{grid[0].date.toLocaleDateString('ko-KR',{month:'short',day:'numeric'})}</span>
                <span>오늘</span>
            </div>
        </div>
    );
}

function timeAgo(d) {
    const s = (Date.now()-new Date(d))/1000;
    if (s<60) return '방금 전';
    if (s<3600) return `${Math.floor(s/60)}분 전`;
    if (s<86400) return `${Math.floor(s/3600)}시간 전`;
    return new Date(d).toLocaleDateString('ko-KR',{month:'short',day:'numeric'});
}

// ── 위젯 선택 모달 ─────────────────────────────────────────
function WidgetCatalogModal({ active, onAdd, onClose }) {
    return (
        <div className="ins-modal-overlay" onClick={onClose}>
            <div className="ins-modal-box" onClick={e=>e.stopPropagation()}>
                <div className="ins-modal-header">
                    <span className="ins-modal-title">위젯 생성</span>
                    <button className="ins-modal-close" onClick={onClose}><IcX size={16}/></button>
                </div>
                <div className="ins-modal-grid">
                    {WIDGET_CATALOG.map(w => {
                        const isActive = active.includes(w.id);
                        return (
                            <div key={w.id} className={`ins-widget-card ${isActive ? 'active' : ''}`}>
                                <div className="ins-widget-card-icon"><w.icon size={28}/></div>
                                <div className="ins-widget-card-label">{w.label}</div>
                                <div className="ins-widget-card-desc">{w.desc}</div>
                                <button
                                    className={`ins-widget-card-btn ${isActive ? 'remove' : ''}`}
                                    onClick={() => onAdd(w.id)}
                                >
                                    {isActive ? '제거' : '+ 추가'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── 개별 위젯 렌더러 ───────────────────────────────────────
function Widget({ id, data, tasks, groups, projectId, onRemove }) {
    const { insight, activityLogs } = data;

    const renderBody = () => {
        if (id === 'summary') {
            const t = insight?.total || {};
            const doneRate = t.total>0 ? Math.round((t.done/t.total)*100) : 0;
            return (
                <div className="ins-stat-row">
                    {[
                        { label:'전체 업무', val: Number(t.total)||0, cls:'' },
                        { label:'완료',      val: Number(t.done)||0,  cls:'accent-green', sub: doneRate+'%' },
                        { label:'진행 중',   val: Number(t.in_progress)||0, cls:'accent-blue' },
                        { label:'평균 진행률',val:(t.avg_progress||0)+'%', cls:'accent-purple' },
                    ].map(s => (
                        <div key={s.label} className={`ins-stat-card ${s.cls}`}>
                            <span className="ins-stat-label">{s.label}</span>
                            <span className="ins-stat-value">{s.val}</span>
                            {s.sub && <span className="ins-stat-sub">{s.sub}</span>}
                        </div>
                    ))}
                </div>
            );
        }
        if (id === 'status_donut') {
            const t = insight?.total || {};
            const statusData = [
                { label:STATUS_KO.done,        value:Number(t.done)||0,        color:STATUS_COLOR.done },
                { label:STATUS_KO.in_progress, value:Number(t.in_progress)||0, color:STATUS_COLOR.in_progress },
                { label:STATUS_KO.todo,        value:Number(t.todo)||0,        color:STATUS_COLOR.todo },
                { label:STATUS_KO.on_hold,     value:Number(t.on_hold)||0,     color:STATUS_COLOR.on_hold },
            ].filter(d=>d.value>0);
            return (
                <div className="ins-donut-wrap">
                    <DonutChart data={statusData} size={130}/>
                    <div className="ins-legend">
                        {statusData.map(d => (
                            <div key={d.label} className="ins-legend-item">
                                <span className="ins-legend-dot" style={{background:d.color}}/>
                                <span className="ins-legend-label">{d.label}</span>
                                <span className="ins-legend-val">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        if (id === 'priority_bar') {
            const pm = {};
            (insight?.byPriority||[]).forEach(p => { pm[p.priority] = Number(p.cnt); });
            const max = Math.max(...Object.values(pm), 1);
            return (
                <div className="ins-priority-bars">
                    {['urgent','high','normal','low'].map(p => {
                        const cnt = pm[p]||0;
                        return (
                            <div key={p} className="ins-priority-row">
                                <span className="ins-priority-label" style={{color:PRIORITY_COLOR[p]}}>{PRIORITY_KO[p]}</span>
                                <div className="ins-priority-bar-wrap">
                                    <div className="ins-priority-bar-fill" style={{width:`${Math.round((cnt/max)*100)}%`,background:PRIORITY_COLOR[p]}}/>
                                </div>
                                <span className="ins-priority-cnt">{cnt}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        if (id === 'group_progress') {
            const bg = insight?.byGroup || [];
            return bg.length === 0 ? <div className="ins-empty-msg">그룹 없음</div> : (
                <div className="ins-group-list">
                    {bg.map(g => {
                        const pct = g.total>0 ? Math.round((g.done/g.total)*100) : 0;
                        return (
                            <div key={g.id} className="ins-group-row">
                                <div className="ins-group-dot" style={{background:g.color||'#667eea'}}/>
                                <span className="ins-group-name">{g.name}</span>
                                <div className="ins-group-bar-wrap">
                                    <div className="ins-group-bar-fill" style={{width:`${pct}%`,background:g.color||'#667eea'}}/>
                                </div>
                                <span className="ins-group-pct">{pct}%</span>
                                <span className="ins-group-count">{g.done}/{g.total}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        if (id === 'weekly_trend') {
            return <Sparkline data={insight?.recentActivity||[]}/>;
        }
        if (id === 'assignee_tasks') {
            const map = {};
            tasks.forEach(t => {
                (t.assignees||[]).forEach(a => {
                    map[a.name] = (map[a.name]||0) + 1;
                });
            });
            const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
            const max = entries[0]?.[1] || 1;
            return entries.length===0 ? <div className="ins-empty-msg">담당자 없음</div> : (
                <div className="ins-assignee-bars">
                    {entries.map(([name,cnt]) => (
                        <div key={name} className="ins-priority-row">
                            <span className="ins-priority-label" style={{color:'#374151',width:60}}>{name}</span>
                            <div className="ins-priority-bar-wrap">
                                <div className="ins-priority-bar-fill" style={{width:`${Math.round((cnt/max)*100)}%`,background:'#667eea'}}/>
                            </div>
                            <span className="ins-priority-cnt">{cnt}</span>
                        </div>
                    ))}
                </div>
            );
        }
        if (id === 'activity_log') {
            const ACTION_LABEL = {
                task_created:'업무 추가', task_status_changed:'상태 변경',
                task_assigned:'담당자 지정', feed_posted:'피드 게시',
                comment_added:'댓글', group_created:'그룹 추가',
            };
            return activityLogs.length===0 ? <div className="ins-empty-msg">활동 없음</div> : (
                <div className="ins-activity-list">
                    {activityLogs.slice(0,8).map(log => (
                        <div key={log.id} className="ins-activity-item">
                            <div className="ins-activity-avatar">{log.user_name?.[0]}</div>
                            <div className="ins-activity-body">
                                <span className="ins-activity-user">{log.user_name}</span>
                                <span className="ins-activity-action">{ACTION_LABEL[log.action]||log.action}</span>
                                {log.task_title && <span className="ins-activity-task">"{log.task_title}"</span>}
                            </div>
                            <span className="ins-activity-time">{timeAgo(log.created_at)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    const catalog = WIDGET_CATALOG.find(w=>w.id===id);

    return (
        <div className={`ins-widget ${id==='summary'?'ins-widget-full':''}`}>
            <div className="ins-widget-header">
                <span className="ins-widget-title">{catalog?.label}</span>
                <button className="ins-widget-remove" onClick={()=>onRemove(id)} title="위젯 제거"><IcX size={13}/></button>
            </div>
            <div className="ins-widget-body">{renderBody()}</div>
        </div>
    );
}

// ── 메인 InsightTab ────────────────────────────────────────
const STORAGE_KEY = (pid) => `insight_widgets_${pid}`;
const DEFAULT_WIDGETS = ['summary','status_donut','priority_bar','group_progress','weekly_trend'];

export default function InsightTab({ projectId, tasks = [], groups = [] }) {
    const [insight, setInsight]       = useState(null);
    const [activityLogs, setActivityLogs] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showModal, setShowModal]   = useState(false);
    const [activeWidgets, setActiveWidgets] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY(projectId));
            return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
        } catch { return DEFAULT_WIDGETS; }
    });

    const saveWidgets = (list) => {
        setActiveWidgets(list);
        localStorage.setItem(STORAGE_KEY(projectId), JSON.stringify(list));
    };

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [insRes, actRes] = await Promise.all([
                api.get(`/projects/${projectId}/insights`),
                api.get(`/projects/${projectId}/activity?limit=30`),
            ]);
            setInsight(insRes.data);
            setActivityLogs(actRes.data.logs || []);
        } catch {} finally { setLoading(false); }
    }, [projectId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleToggleWidget = (wid) => {
        if (activeWidgets.includes(wid)) {
            saveWidgets(activeWidgets.filter(w => w !== wid));
        } else {
            saveWidgets([...activeWidgets, wid]);
        }
    };

    const handleRemove = (wid) => saveWidgets(activeWidgets.filter(w => w !== wid));

    if (loading) return <div className="ins-loading"><div className="page-loader-spinner"/></div>;

    const data = { insight, activityLogs };

    return (
        <div className="ins-wrap">
            {/* 헤더 */}
            <div className="ins-header">
                <span className="ins-header-title">인사이트</span>
                <button className="ins-add-widget-btn" onClick={() => setShowModal(true)}>
                    <IcPlus size={14}/> 위젯 생성
                </button>
            </div>

            {/* 위젯 그리드 */}
            {activeWidgets.length === 0 ? (
                <div className="ins-empty-state">
                    <IcBar size={40} color="#d1d5db"/>
                    <p>위젯을 추가해 프로젝트 현황을 한눈에 확인하세요.</p>
                    <button className="ins-add-widget-btn" onClick={() => setShowModal(true)}>
                        <IcPlus size={14}/> 위젯 생성
                    </button>
                </div>
            ) : (
                <div className="ins-widget-grid">
                    {activeWidgets.map(wid => (
                        <Widget key={wid} id={wid} data={data} tasks={tasks} groups={groups}
                            projectId={projectId} onRemove={handleRemove}/>
                    ))}
                </div>
            )}

            {showModal && (
                <WidgetCatalogModal
                    active={activeWidgets}
                    onAdd={handleToggleWidget}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
}
