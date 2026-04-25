import React, { useState, useMemo } from 'react';
import './CalendarTab.css';
import { IconChevronDown, IconChevronRight } from '../common/Icons';

const IconChevronLeft = (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6"/>
    </svg>
);

const STATUS_COLOR = {
    done:        '#10b981',
    in_progress: '#667eea',
    todo:        '#94a3b8',
    on_hold:     '#f59e0b',
};
const STATUS_KO = { done:'완료', in_progress:'진행 중', todo:'할 일', on_hold:'보류' };
const DAYS_KO   = ['일', '월', '화', '수', '목', '금', '토'];

function toYMD(d) {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function CalendarTab({ tasks }) {
    const today = new Date();
    const [year,  setYear]  = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [expanded, setExpanded] = useState(null);

    const prevMonth = () => {
        if (month === 0) { setYear(y => y - 1); setMonth(11); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 11) { setYear(y => y + 1); setMonth(0); }
        else setMonth(m => m + 1);
    };
    const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

    // 달력 셀 생성
    const cells = useMemo(() => {
        const first = new Date(year, month, 1);
        const last  = new Date(year, month + 1, 0);
        const startOffset = first.getDay();
        const totalCells  = Math.ceil((startOffset + last.getDate()) / 7) * 7;
        return Array.from({ length: totalCells }, (_, i) => {
            const day = i - startOffset + 1;
            if (day < 1 || day > last.getDate()) return null;
            return new Date(year, month, day);
        });
    }, [year, month]);

    // due_date 기준 태스크 맵
    const tasksByDay = useMemo(() => {
        const map = {};
        tasks.forEach(t => {
            if (!t.due_date) return;
            const key = toYMD(t.due_date);
            if (!map[key]) map[key] = [];
            map[key].push(t);
        });
        return map;
    }, [tasks]);

    const todayYMD = toYMD(today);

    return (
        <div className="cal-wrap">
            {/* 헤더 */}
            <div className="cal-header">
                <button className="cal-nav-btn" onClick={prevMonth}><IconChevronLeft size={16} /></button>
                <div className="cal-title">
                    {year}년 {month + 1}월
                </div>
                <button className="cal-nav-btn" onClick={nextMonth}><IconChevronRight size={16} /></button>
                <button className="cal-today-btn" onClick={goToday}>오늘</button>
            </div>

            {/* 요일 헤더 */}
            <div className="cal-dow-row">
                {DAYS_KO.map((d, i) => (
                    <div key={i} className={`cal-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>{d}</div>
                ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="cal-grid">
                {cells.map((date, i) => {
                    if (!date) return <div key={i} className="cal-cell empty" />;
                    const ymd = toYMD(date);
                    const dayTasks = tasksByDay[ymd] || [];
                    const isToday = ymd === todayYMD;
                    const dow = date.getDay();
                    const isExp = expanded === ymd;

                    return (
                        <div
                            key={i}
                            className={`cal-cell ${isToday ? 'today' : ''} ${dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''} ${dayTasks.length > 0 ? 'has-tasks' : ''}`}
                        >
                            <div
                                className={`cal-day-num ${isToday ? 'today' : ''}`}
                            >
                                {date.getDate()}
                            </div>

                            {/* 태스크 배지 (최대 2개) */}
                            {dayTasks.slice(0, 2).map(t => (
                                <div
                                    key={t.id}
                                    className="cal-task-badge"
                                    style={{ background: STATUS_COLOR[t.status] || '#94a3b8' }}
                                    title={t.title}
                                >
                                    <span className="cal-task-badge-text">{t.title}</span>
                                </div>
                            ))}

                            {dayTasks.length > 2 && (
                                <button
                                    className="cal-more-btn"
                                    onClick={() => setExpanded(isExp ? null : ymd)}
                                >
                                    +{dayTasks.length - 2}개
                                    {isExp ? <IconChevronDown size={10} /> : <IconChevronRight size={10} />}
                                </button>
                            )}

                            {/* 펼침 팝오버 */}
                            {isExp && dayTasks.length > 2 && (
                                <div className="cal-popover">
                                    <div className="cal-popover-date">
                                        {month + 1}월 {date.getDate()}일 마감
                                    </div>
                                    {dayTasks.map(t => (
                                        <div key={t.id} className="cal-popover-item">
                                            <span className="cal-pop-dot" style={{ background: STATUS_COLOR[t.status] }} />
                                            <span className="cal-pop-title">{t.title}</span>
                                            <span className="cal-pop-status">{STATUS_KO[t.status]}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 하단 요약 */}
            <div className="cal-footer">
                {Object.entries(STATUS_COLOR).map(([k, c]) => {
                    const cnt = tasks.filter(t => {
                        if (!t.due_date) return false;
                        const d = new Date(t.due_date);
                        return d.getFullYear() === year && d.getMonth() === month && t.status === k;
                    }).length;
                    return cnt > 0 ? (
                        <div key={k} className="cal-footer-item">
                            <span className="cal-footer-dot" style={{ background: c }} />
                            {STATUS_KO[k]} {cnt}개
                        </div>
                    ) : null;
                })}
            </div>
        </div>
    );
}
