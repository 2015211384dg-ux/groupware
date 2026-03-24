import React, { useState, useEffect } from 'react';
import './EventModal.css';
import { useToast } from '../components/Toast';

function EventModal({ 
    show, 
    onClose, 
    onSubmit, 
    onDelete,
    formData, 
    setFormData, 
    myCalendars = [],
    deptCalendars = [],
    isEdit 
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
        
        // FormData 객체 생성 (파일 업로드를 위해)
        const submitFormData = new FormData();
        
        // 일정 데이터 추가
        Object.keys(formData).forEach(key => {
            if (formData[key] !== null && formData[key] !== undefined) {
                submitFormData.append(key, formData[key]);
            }
        });
        
        // 첨부파일 추가
        attachments.forEach(file => {
            submitFormData.append('attachments', file);
        });
        
        onSubmit(submitFormData);
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
                                <div className="form-icon">📝</div>
                                <input
                                    type="text"
                                    value={formData.title || ''}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    placeholder="제목을 입력하세요"
                                    className="event-title-input"
                                    required
                                />
                            </div>

                            {/* 날짜 및 시간 */}
                            <div className="event-form-row">
                                <div className="form-icon">🕐</div>
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
                                <div className="form-icon">📅</div>
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
                                <div className="form-icon">🔒</div>
                                <div className="visibility-options">
                                    <label>
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="public"
                                            checked={formData.visibility === 'public'}
                                            onChange={(e) => setFormData({...formData, visibility: e.target.value})}
                                        />
                                        <span>전체 공개</span>
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="department"
                                            checked={formData.visibility === 'department'}
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
                                        <span>비공개</span>
                                    </label>
                                </div>
                            </div>

                            {/* 부서 선택 (부서 공개인 경우) */}
                            {formData.visibility === 'department' && (
                                <div className="event-form-row">
                                    <div className="form-icon">🏢</div>
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
                                <div className="form-icon">📍</div>
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
                                <div className="form-icon">📄</div>
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
                                <div className="form-icon">📎</div>
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