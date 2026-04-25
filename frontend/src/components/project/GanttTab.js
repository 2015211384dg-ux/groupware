import React, { useMemo, useRef, useState, useEffect } from 'react';
import './GanttTab.css';

const STATUS_COLOR = {
    done:        '#10b981',
    in_progress: '#667eea',
    todo:        '#94a3b8',
    on_hold:     '#f59e0b',
};
const STATUS_KO = { done:'완료', in_progress:'진행 중', todo:'할 일', on_hold:'보류' };

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}
function diffDays(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function toYMD(date) {
    return new Date(date).toISOString().slice(0, 10);
}

const CELL_W  = 32;
const ROW_H   = 36;
const LABEL_W = 180;

export default function GanttTab({ tasks, groups }) {
    const scrollRef  = useRef(null);
    const dragRef    = useRef({ x: 0, scrollLeft: 0 });
    const [hoveredTask, setHoveredTask] = useState(null);
    const [isDragging, setIsDragging]   = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);

    // 컨테이너 폭 측정
    useEffect(() => {
        if (!scrollRef.current) return;
        const ro = new ResizeObserver(entries => {
            setContainerWidth(entries[0].contentRect.width);
        });
        ro.observe(scrollRef.current);
        return () => ro.disconnect();
    }, []);

    // 데이터 기반 날짜 범위
    const { start, dateDays } = useMemo(() => {
        const dates = tasks.flatMap(t => [
            t.start_date, t.due_date, t.created_at
        ]).filter(Boolean).map(d => new Date(d));

        const today = new Date();
        const minD  = dates.length ? new Date(Math.min(...dates)) : addDays(today, -7);
        const maxD  = dates.length ? new Date(Math.max(...dates)) : addDays(today, 30);

        const s = addDays(minD, -3);
        const e = addDays(maxD, 7);
        s.setHours(0,0,0,0);
        e.setHours(0,0,0,0);

        return { start: s, dateDays: diffDays(s, e) + 1 };
    }, [tasks]);

    // 컨테이너를 채울 만큼 날짜 수 확장
    const totalDays = Math.max(
        dateDays,
        containerWidth ? Math.ceil(containerWidth / CELL_W) + 1 : dateDays
    );
    const end = addDays(start, totalDays - 1);

    // 월 헤더 그룹
    const monthGroups = useMemo(() => {
        const result = [];
        let cur = new Date(start);
        while (cur <= end) {
            const y = cur.getFullYear(), m = cur.getMonth();
            const monthStart = new Date(y, m, 1);
            const monthEnd   = new Date(y, m + 1, 0);
            const from = Math.max(diffDays(start, monthStart), 0);
            const to   = Math.min(diffDays(start, monthEnd), totalDays - 1);
            result.push({ label: `${y}년 ${m + 1}월`, from, span: to - from + 1 });
            cur = new Date(y, m + 1, 1);
        }
        return result;
    }, [start, end, totalDays]);

    // 오늘 위치
    const todayOffset = useMemo(() => {
        const d = diffDays(start, new Date());
        return d >= 0 && d < totalDays ? d : -1;
    }, [start, totalDays]);

    // 그룹별 태스크
    const grouped = useMemo(() => {
        const map = {};
        groups.forEach(g => { map[g.id] = { group: g, tasks: [] }; });
        map[null] = { group: { id: null, name: '미지정', color: '#94a3b8' }, tasks: [] };
        tasks.forEach(t => {
            const key = t.group_id ?? null;
            if (!map[key]) map[key] = { group: { id: key, name: '미지정', color: '#94a3b8' }, tasks: [] };
            map[key].tasks.push(t);
        });
        return Object.values(map).filter(g => g.tasks.length > 0);
    }, [tasks, groups]);

    const getTaskBar = (task) => {
        const s = task.start_date || task.created_at;
        const e = task.due_date;
        if (!e) return null;
        const left  = Math.max(diffDays(start, s), 0);
        const right = Math.min(diffDays(start, e), totalDays - 1);
        if (right < 0 || left >= totalDays) return null;
        const width = Math.max((right - left + 1) * CELL_W, CELL_W * 0.5);
        return { left: left * CELL_W, width };
    };

    // 드래그 스크롤
    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        dragRef.current = { x: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
    };
    const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragRef.current.x;
        scrollRef.current.scrollLeft = dragRef.current.scrollLeft - dx;
    };
    const onMouseUp = () => setIsDragging(false);

    if (tasks.length === 0) {
        return (
            <div className="gantt-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                    <path d="M8 14h2M12 14h4M8 18h2"/>
                </svg>
                <p>업무에 마감일을 설정하면 간트차트가 표시됩니다.</p>
            </div>
        );
    }

    return (
        <div className="gantt-wrap">
            <div className="gantt-container">
                {/* 레이블 컬럼 */}
                <div className="gantt-labels" style={{ width: LABEL_W }}>
                    <div className="gantt-label-header">업무</div>
                    {grouped.map(({ group, tasks: gTasks }) => (
                        <React.Fragment key={group.id ?? 'null'}>
                            <div className="gantt-group-label">
                                <span className="gantt-group-dot" style={{ background: group.color || '#667eea' }} />
                                {group.name}
                            </div>
                            {gTasks.map(t => (
                                <div
                                    key={t.id}
                                    className={`gantt-task-label ${hoveredTask === t.id ? 'hovered' : ''}`}
                                    style={{ height: ROW_H }}
                                    onMouseEnter={() => setHoveredTask(t.id)}
                                    onMouseLeave={() => setHoveredTask(null)}
                                >
                                    <span className="gantt-task-dot" style={{ background: STATUS_COLOR[t.status] || '#94a3b8' }} />
                                    <span className="gantt-task-name">{t.title}</span>
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>

                {/* 타임라인 */}
                <div
                    className={`gantt-timeline-wrap${isDragging ? ' dragging' : ''}`}
                    ref={scrollRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                >
                    <div className="gantt-timeline" style={{ width: totalDays * CELL_W }}>
                        {/* 월 헤더 */}
                        <div className="gantt-month-row" style={{ height: 28 }}>
                            {monthGroups.map((mg, i) => (
                                <div
                                    key={i}
                                    className="gantt-month-cell"
                                    style={{ left: mg.from * CELL_W, width: mg.span * CELL_W }}
                                >
                                    {mg.label}
                                </div>
                            ))}
                        </div>

                        {/* 일 헤더 */}
                        <div className="gantt-day-row" style={{ height: 24 }}>
                            {Array.from({ length: totalDays }, (_, i) => {
                                const d = addDays(start, i);
                                const isToday   = toYMD(d) === toYMD(new Date());
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                    <div
                                        key={i}
                                        className={`gantt-day-cell${isToday ? ' today' : ''}${isWeekend ? ' weekend' : ''}`}
                                        style={{ left: i * CELL_W, width: CELL_W }}
                                    >
                                        {d.getDate()}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 오늘 선 */}
                        {todayOffset >= 0 && (
                            <div className="gantt-today-line" style={{ left: (todayOffset + 0.5) * CELL_W }} />
                        )}

                        {/* 주말 음영 */}
                        {Array.from({ length: totalDays }, (_, i) => {
                            const d = addDays(start, i);
                            if (d.getDay() !== 0 && d.getDay() !== 6) return null;
                            return (
                                <div key={i} className="gantt-weekend-bg" style={{ left: i * CELL_W, width: CELL_W }} />
                            );
                        })}

                        {/* 태스크 바 */}
                        {grouped.map(({ group, tasks: gTasks }) => {
                            const rows = [];
                            rows.push(
                                <div key={`g-${group.id}`} className="gantt-group-row" style={{ height: ROW_H }} />
                            );
                            gTasks.forEach(t => {
                                const bar = getTaskBar(t);
                                rows.push(
                                    <div
                                        key={t.id}
                                        className={`gantt-task-row${hoveredTask === t.id ? ' hovered' : ''}`}
                                        style={{ height: ROW_H }}
                                        onMouseEnter={() => setHoveredTask(t.id)}
                                        onMouseLeave={() => setHoveredTask(null)}
                                    >
                                        {bar && (
                                            <div
                                                className="gantt-bar"
                                                style={{
                                                    left: bar.left,
                                                    width: bar.width,
                                                    background: STATUS_COLOR[t.status] || '#94a3b8',
                                                    opacity: t.status === 'done' ? 0.7 : 1,
                                                }}
                                                title={`${t.title}\n${STATUS_KO[t.status]}${t.due_date ? '\n마감: ' + new Date(t.due_date).toLocaleDateString('ko-KR') : ''}`}
                                            >
                                                {bar.width > 60 && (
                                                    <span className="gantt-bar-label">{t.title}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                            return rows;
                        })}
                    </div>
                </div>
            </div>

            {/* 범례 */}
            <div className="gantt-legend">
                {Object.entries(STATUS_COLOR).map(([k, c]) => (
                    <div key={k} className="gantt-legend-item">
                        <span className="gantt-legend-dot" style={{ background: c }} />
                        {STATUS_KO[k]}
                    </div>
                ))}
            </div>
        </div>
    );
}
