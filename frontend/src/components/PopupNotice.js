import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/authService';
import { IconMegaphone, IconX, IconChevronRight } from './Icons';
import './PopupNotice.css';

const HIDE_TODAY_PREFIX = 'popup_hide_today_';
const SESSION_PREFIX    = 'popup_dismissed_';

const todayStr = () => new Date().toISOString().slice(0, 10);

function isHiddenToday(id) {
    return localStorage.getItem(HIDE_TODAY_PREFIX + id) === todayStr();
}

function isDismissed(id) {
    return sessionStorage.getItem(SESSION_PREFIX + id) === '1';
}

function PopupNotice() {
    const [notices, setNotices] = useState([]);
    const [current, setCurrent] = useState(0);
    const [hideToday, setHideToday] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get('/settings/notices/public');
                const active = (res.data.data || []).filter(
                    n => !isHiddenToday(n.id) && !isDismissed(n.id)
                );
                setNotices(active);
                setCurrent(0);
            } catch {
                // 공지 조회 실패는 무시
            }
        };
        load();
    }, [location.pathname]);

    if (notices.length === 0) return null;

    const notice = notices[current];
    const total  = notices.length;

    const dismiss = (id) => {
        if (hideToday) {
            localStorage.setItem(HIDE_TODAY_PREFIX + id, todayStr());
        } else {
            sessionStorage.setItem(SESSION_PREFIX + id, '1');
        }
    };

    const handleClose = () => {
        dismiss(notice.id);
        const remaining = notices.filter((_, i) => i !== current);
        if (remaining.length === 0) {
            setNotices([]);
        } else {
            setNotices(remaining);
            setCurrent(prev => Math.min(prev, remaining.length - 1));
        }
        setHideToday(false);
    };

    const handleCloseAll = () => {
        notices.forEach(n => {
            if (hideToday) {
                localStorage.setItem(HIDE_TODAY_PREFIX + n.id, todayStr());
            } else {
                sessionStorage.setItem(SESSION_PREFIX + n.id, '1');
            }
        });
        setNotices([]);
    };

    const prev = () => setCurrent(c => (c - 1 + total) % total);
    const next = () => setCurrent(c => (c + 1) % total);

    return (
        <div className="popup-notice-overlay" onClick={handleClose}>
            <div className="popup-notice-box" onClick={e => e.stopPropagation()}>
                <div className="popup-notice-header">
                    <span className="popup-notice-icon"><IconMegaphone size={20} /></span>
                    <h3>{notice.title || '공지사항'}</h3>
                    {total > 1 && (
                        <span className="popup-notice-count">{current + 1} / {total}</span>
                    )}
                    <button className="popup-notice-close" onClick={handleClose} title="닫기">
                        <IconX size={16} />
                    </button>
                </div>

                <div className="popup-notice-body">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{notice.content}</p>
                </div>

                {total > 1 && (
                    <div className="popup-notice-nav">
                        <button onClick={prev} className="popup-nav-btn">
                            {/* ChevronLeft: ChevronRight을 뒤집어서 사용 */}
                            <IconChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        <div className="popup-nav-dots">
                            {notices.map((_, i) => (
                                <button
                                    key={i}
                                    className={`popup-nav-dot${i === current ? ' active' : ''}`}
                                    onClick={() => setCurrent(i)}
                                />
                            ))}
                        </div>
                        <button onClick={next} className="popup-nav-btn">
                            <IconChevronRight size={16} />
                        </button>
                    </div>
                )}

                <div className="popup-notice-footer">
                    <label className="popup-hide-today">
                        <input
                            type="checkbox"
                            checked={hideToday}
                            onChange={e => setHideToday(e.target.checked)}
                        />
                        <span>오늘 하루 보지 않기</span>
                    </label>
                    <div className="popup-footer-btns">
                        {total > 1 && (
                            <button className="popup-notice-close-all" onClick={handleCloseAll}>
                                전체 닫기
                            </button>
                        )}
                        <button className="popup-notice-confirm" onClick={handleClose}>확인</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PopupNotice;
