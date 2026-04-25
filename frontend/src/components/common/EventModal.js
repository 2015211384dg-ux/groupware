import React, { useState, useEffect } from 'react';
import './EventModal.css';
import { useToast } from './Toast';

function EventModal({
    show,
    onClose,
    onSubmit,
    onDelete,
    formData,
    setFormData,
    myCalendars = [],
    deptCalendars = [],
    isEdit,
    creatorName = null,
    canPublic = false
}) {
    const toast = useToast();
    const [miniCalDate, setMiniCalDate] = useState(new Date());
    const [attachments, setAttachments] = useState([]);

    useEffect(() => {
        console.log('EventModal - myCalendars:', myCalendars);
        console.log('EventModal - deptCalendars:', deptCalendars);
    }, [myCalendars, deptCalendars]);

    if (!show) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        if (attachments.length > 0) {
            const submitFormData = new FormData();
            Object.keys(formData).forEach(key => {
                if (formData[key] !== null && formData[key] !== undefined) {
                    submitFormData.append(key, formData[key]);
                }
            });
            attachments.forEach(file => {
                submitFormData.append('attachments', file);
            });
            onSubmit(submitFormData);
        } else {
            onSubmit(formData);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        const totalSize = getTotalSize() + files.reduce((sum, f) => sum + f.size, 0);
        
        // 100MB 제한
        if (totalSize > 100 * 1024 * 1024) {
            toast.warning('첨부파일 용량은 100MB를 초과할 수 없습니다.');
            return;
        }
        
        setAttachments(prev => [...prev, ...files]);
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const getTotalSize = () => {
        return attachments.reduce((sum, file) => sum + file.size, 0);
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0KB';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + sizes[i];
    };

    // 미니 캘린더 렌더링
    const renderMiniCalendar = () => {
        const year = miniCalDate.getFullYear();
        const month = miniCalDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        const days = [];
        
        // 이전 달 빈 칸
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="event-mini-day empty"></div>);
        }

        // 현재 달 날짜
        for (let date = 1; date <= lastDate; date++) {
            const isToday = today.getFullYear() === year && 
                           today.getMonth() === month && 
                           today.getDate() === date;
            
            const isSelected = formData.start_date && 
                              new Date(formData.start_date).getDate() === date &&
                              new Date(formData.start_date).getMonth() === month &&
                              new Date(formData.start_date).getFullYear() === year;

            days.push(
                <div 
                    key={date} 
                    className={`event-mini-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                        setFormData({...formData, start_date: dateStr, end_date: dateStr});
                    }}
                >
                    {date}
                </div>
            );
        }

        return days;
    };

    const prevMiniMonth = () => {
        setMiniCalDate(new Date(miniCalDate.getFullYear(), miniCalDate.getMonth() - 1));
    };

    const nextMiniMonth = () => {
        setMiniCalDate(new Date(miniCalDate.getFullYear(), miniCalDate.getMonth() + 1));
    };

    return (
        <>
            <div className="event-modal-overlay" onClick={onClose}></div>
            <div className="event-modal-container">
                {/* 탭 */}
                <div className="event-modal-tabs">
                    <button className="tab-btn active">
                        기본정보
                    </button>
                </div>

                <div className="event-modal-content">
                    {/* 왼쪽: 폼 */}
                    <div className="event-form-section">
                        <form onSubmit={handleSubmit}>
                            {/* 제목 */}
                            <div className="event-form-row">
                                <div className="form-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={formData.title || ''}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    placeholder="제목을 입력하세요"
                                    className="event-title-input"
                                    required
                                />
                            </div>

                            {/* 등록자 (수정 모드에서만 표시) */}
                            {isEdit && creatorName && (
                                <div className="event-form-row">
                                    <div className="form-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                            <circle cx="12" cy="7" r="4"/>
                                        </svg>
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#191f28', padding: '6px 0' }}>
                                        {creatorName}
                                    </span>
                                </div>
                            )}

                            {/* 날짜 및 시간 */}
                            <div className="event-form-row">
                                <div className="form-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                </div>
                                <div className="datetime-inputs">
                                    <div className="date-row">
                                        <input
                                            type="date"
                                            value={formData.start_date || ''}
                                            onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                                            required
                                        />
                                        {!formData.all_day && (
                                            <select
                                                value={formData.start_time || ''}
                                                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                                            >
                                                <option value="">시간 선택</option>
                                                {Array.from({length: 24}, (_, h) => 
                                                    ['00', '30'].map(m => {
                                                        const time = `${String(h).padStart(2, '0')}:${m}`;
                                                        return <option key={time} value={time}>{`${h < 12 ? '오전' : '오후'} ${time}`}</option>;
                                                    })
                                                ).flat()}
                                            </select>
                                        )}
                                    </div>
                                    <div className="separator">-</div>
                                    <div className="date-row">
                                        <input
                                            type="date"
                                            value={formData.end_date || ''}
                                            onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                                            required
                                        />
                                        {!formData.all_day && (
                                            <select
                                                value={formData.end_time || ''}
                                                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                                            >
                                                <option value="">시간 선택</option>
                                                {Array.from({length: 24}, (_, h) => 
                                                    ['00', '30'].map(m => {
                                                        const time = `${String(h).padStart(2, '0')}:${m}`;
                                                        return <option key={time} value={time}>{`${h < 12 ? '오전' : '오후'} ${time}`}</option>;
                                                    })
                                                ).flat()}
                                            </select>
                                        )}
                                    </div>
                                    <label className="all-day-toggle">
                                        <span>종일</span>
                                        <input
                                            type="checkbox"
                                            checked={formData.all_day || false}
                                            onChange={(e) => setFormData({...formData, all_day: e.target.checked})}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* 캘린더 선택 */}
                            <div className="event-form-row">
                                <div className="form-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                        <line x1="16" y1="2" x2="16" y2="6"/>
                                        <line x1="8" y1="2" x2="8" y2="6"/>
                                        <line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                </div>
                                <select
                                    value={formData.category || 'work'}
                                    onChange={(e) => {
                                        const category = e.target.value;
                                        const calendar = myCalendars.find(cal => cal.id === category);
                                        setFormData({...formData, category, color: calendar?.color || '#ff6b35'});
                                    }}
                                    className="calendar-select"
                                >
                                    {myCalendars.length > 0 ? (
                                        myCalendars.map(cal => (
                                            <option key={cal.id} value={cal.id}>
                                                {cal.name}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="work">업무일정</option>
                                    )}
                                </select>
                            </div>

                            {/* 공개 범위 */}
                            <div className="event-form-row">
                                <div className="form-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                </div>
                                <div className="visibility-options">
                                    <label>
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="department"
                                            checked={formData.visibility === 'department' || (!canPublic && formData.visibility === 'public')}
                                            onChange={(e) => setFormData({...formData, visibility: e.target.value})}
                                        />
                                        <span>부서 공개</span>
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="private"
                                            checked={formData.visibility === 'private'}
                                            onChange={(e) => setFormData({...formData, visibility: e.target.value})}
                                        />
                                        <span>나만 보기</span>
                                    </label>
                                    {canPublic && (
                                        <label>
                                            <input
                                                type="radio"
                                                name="visibility"
                                                value="public"
                                                checked={formData.visibility === 'public'}
                                                onChange={(e) => setFormData({...formData, visibility: e.target.value})}
                                            />
                                            <span>전직원 공개 (Amphenol)</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* 부서 선택 (부서 공개인 경우) */}
                            {formData.visibility === 'department' && (
                                <div className="event-form-row">
                                    <div className="form-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="1"/>
                                        <line x1="9" y1="3" x2="9" y2="21"/>
                                        <line x1="15" y1="3" x2="15" y2="21"/>
                                        <line x1="3" y1="9" x2="9" y2="9"/>
                                        <line x1="3" y1="15" x2="9" y2="15"/>
                                        <line x1="15" y1="9" x2="21" y2="9"/>
                                        <line x1="15" y1="15" x2="21" y2="15"/>
                                    </svg>
                                </div>
                                    <select
                                        value={formData.department_id || ''}
                                        onChange={(e) => setFormData({...formData, department_id: parseInt(e.target.value)})}
                                        className="event-input"
                                        required
                                    >
                                        <option value="">부서 선택</option>
                                        {deptCalendars.length > 0 ? (
                                            deptCalendars.map(dept => (
                                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                                            ))
                                        ) : (
                                            <option value="" disabled>부서 목록이 없습니다</option>
                                        )}
                                    </select>
                                </div>
                            )}

                            {/* 장소 */}
                            <div className="event-form-row">
                                <div className="form-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={formData.location || ''}
                                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                                    placeholder="장소를 입력하세요"
                                    className="event-input"
                                />
                            </div>

                            {/* 설명 */}
                            <div className="event-form-row description-row">
                                <div className="form-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                        <line x1="16" y1="13" x2="8" y2="13"/>
                                        <line x1="16" y1="17" x2="8" y2="17"/>
                                    </svg>
                                </div>
                                <div className="description-container">
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        placeholder="메모를 작성하세요"
                                        className="event-textarea"
                                        rows="5"
                                    ></textarea>
                                </div>
                            </div>

                            {/* 첨부파일 */}
                            <div className="event-form-row">
                                <div className="form-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                                    </svg>
                                </div>
                                <div className="attachment-container">
                                    <div className="attachment-header">
                                        <input
                                            type="file"
                                            id="file-upload"
                                            multiple
                                            onChange={handleFileChange}
                                            style={{ display: 'none' }}
                                        />
                                        <label htmlFor="file-upload" className="attach-btn">
                                            내 PC
                                        </label>
                                        <span className="file-size">
                                            {formatFileSize(getTotalSize())}/100.00MB
                                        </span>
                                    </div>
                                    {attachments.length > 0 && (
                                        <div className="attachment-list">
                                            {attachments.map((file, index) => (
                                                <div key={index} className="attachment-item">
                                                    <span className="file-name">{file.name}</span>
                                                    <span className="file-info">({formatFileSize(file.size)})</span>
                                                    <button 
                                                        type="button" 
                                                        className="remove-file"
                                                        onClick={() => removeAttachment(index)}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 버튼 */}
                            <div className="event-modal-actions">
                                {isEdit && onDelete && (
                                    <button type="button" className="delete-btn" onClick={onDelete}>
                                        삭제
                                    </button>
                                )}
                                <div style={{ flex: 1 }}></div>
                                <button type="button" className="cancel-btn" onClick={onClose}>
                                    취소
                                </button>
                                <button type="submit" className="save-btn">
                                    {isEdit ? '수정' : '저장'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* 오른쪽: 미니 캘린더 */}
                    <div className="event-calendar-section">
                        <div className="event-mini-calendar">
                            <div className="event-mini-header">
                                <button type="button" onClick={prevMiniMonth}>‹</button>
                                <span>
                                    {miniCalDate.getFullYear()}. {miniCalDate.getMonth() + 1}
                                </span>
                                <button type="button" onClick={nextMiniMonth}>›</button>
                            </div>
                            <div className="event-mini-weekdays">
                                <div>일</div>
                                <div>월</div>
                                <div>화</div>
                                <div>수</div>
                                <div>목</div>
                                <div>금</div>
                                <div>토</div>
                            </div>
                            <div className="event-mini-grid">
                                {renderMiniCalendar()}
                            </div>
                        </div>
                        
                        <div className="event-help-text">
                            * 날짜를 클릭하여 일정 날짜를 선택할 수 있습니다.
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default EventModal;