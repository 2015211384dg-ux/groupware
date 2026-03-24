import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../services/authService';
import EventModal from './EventModal';
import './Calendar.css';
import { useToast } from '../components/Toast';

function Calendar() {
    const toast = useToast();
    const [events, setEvents] = useState([]);
    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [miniCalDate, setMiniCalDate] = useState(new Date());
    const [departments, setDepartments] = useState([]);
    const [user, setUser] = useState(null);

    // 내 캘린더 목록
    const [myCalendars, setMyCalendars] = useState(() => {
        // localStorage에서 저장된 설정 불러오기
        const saved = localStorage.getItem('myCalendars');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('myCalendars 불러오기 실패:', e);
            }
        }
        // 기본값
        return [
            { id: 'work', name: '업무일정', color: '#ff6b35', visible: true, type: 'personal' },
            { id: 'meeting', name: '회의', color: '#4ecdc4', visible: true, type: 'personal' },
            { id: 'personal', name: '개인일정', color: '#95e1d3', visible: true, type: 'personal' },
            { id: 'holiday', name: '휴일', color: '#f38181', visible: true, type: 'personal' }
        ];
    });

    // 부서 캘린더 목록
    const [deptCalendars, setDeptCalendars] = useState(() => {
        // localStorage에서 저장된 설정 불러오기
        const saved = localStorage.getItem('deptCalendars');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('deptCalendars 불러오기 실패:', e);
            }
        }
        return [];
    });

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        all_day: false,
        category: 'work',
        color: '#ff6b35',
        location: '',
        visibility: 'public',  // public, department, private
        department_id: null
    });

    useEffect(() => {
        fetchUserInfo();
        fetchDepartments();
    }, []);

    useEffect(() => {
        if (user) {
            fetchEvents();
        }
    }, [currentDate, user]);

    const fetchUserInfo = async () => {
        try {
            const response = await api.get('/auth/me');
            setUser(response.data.user);
        } catch (error) {
            console.error('사용자 정보 조회 실패:', error);
        }
    };

    const fetchDepartments = async () => {
        try {
            const response = await api.get('/departments');
            console.log('부서 목록 API 응답:', response.data);
            
            // API 응답 형식: { success: true, data: { departments: [...], tree: [...] } }
            let departmentList = [];
            
            if (response.data.data && response.data.data.departments) {
                // Backend의 실제 응답 형식
                departmentList = response.data.data.departments;
            } else if (response.data.departments) {
                departmentList = response.data.departments;
            } else if (response.data.data && Array.isArray(response.data.data)) {
                departmentList = response.data.data;
            } else if (Array.isArray(response.data)) {
                departmentList = response.data;
            }
            
            console.log('부서 목록:', departmentList);
            
            if (!departmentList || departmentList.length === 0) {
                console.warn('⚠️ 부서 데이터가 없습니다. 부서 관리에서 부서를 먼저 등록해주세요.');
                return;
            }
            
            // localStorage에서 저장된 설정 불러오기
            const savedSettings = localStorage.getItem('deptCalendars');
            let savedVisibility = {};
            if (savedSettings) {
                try {
                    const saved = JSON.parse(savedSettings);
                    saved.forEach(dept => {
                        savedVisibility[dept.id] = dept.visible;
                    });
                } catch (e) {
                    console.error('저장된 부서 캘린더 설정 불러오기 실패:', e);
                }
            }
            
            const depts = departmentList.map(dept => ({
                id: dept.id,
                name: dept.name,
                color: getRandomColor(),
                visible: savedVisibility[dept.id] !== undefined ? savedVisibility[dept.id] : true, // 저장된 값 또는 기본 true
                type: 'department'
            }));
            
            console.log('변환된 부서 캘린더 (' + depts.length + '개):', depts);
            setDeptCalendars(depts);
            
            // 새로운 부서 목록을 localStorage에 저장
            localStorage.setItem('deptCalendars', JSON.stringify(depts));
        } catch (error) {
            console.error('❌ 부서 목록 조회 실패:', error);
            console.error('에러 상세:', error.response?.data);
        }
    };

    const getRandomColor = () => {
        const colors = ['#667eea', '#f56565', '#48bb78', '#ed8936', '#9f7aea', '#38b2ac'];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    const fetchEvents = async () => {
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            const response = await api.get(`/events/monthly/${year}/${month}`);
            
            const calendarEvents = response.data.data.map(event => {
                // 부서 일정인 경우 부서 색상 사용
                let eventColor = event.color;
                if (event.visibility === 'department' && event.department_id) {
                    const dept = deptCalendars.find(d => d.id === event.department_id);
                    if (dept) eventColor = dept.color;
                }

                return {
                    id: event.id,
                    title: event.title,
                    start: event.all_day 
                        ? event.start_date 
                        : `${event.start_date}T${event.start_time}`,
                    end: event.all_day 
                        ? event.end_date 
                        : `${event.end_date}T${event.end_time}`,
                    allDay: event.all_day,
                    backgroundColor: eventColor,
                    borderColor: eventColor,
                    extendedProps: {
                        description: event.description,
                        category: event.category,
                        location: event.location,
                        creator_name: event.creator_name,
                        visibility: event.visibility,
                        department_id: event.department_id,
                        department_name: event.department_name
                    }
                };
            });

            setEvents(calendarEvents);
        } catch (error) {
            console.error('일정 조회 실패:', error);
        }
    };

    const handleDateClick = (info) => {
        setFormData({
            ...formData,
            start_date: info.dateStr,
            end_date: info.dateStr,
            department_id: user?.department_id || null
        });
        setSelectedEvent(null);
        setShowEventModal(true);
    };

    const handleEventClick = (info) => {
        setSelectedEvent(info.event);
        
        // 일정 정보를 formData에 채우기
        const event = info.event;
        setFormData({
            title: event.title,
            description: event.extendedProps.description || '',
            start_date: event.startStr.split('T')[0],
            end_date: event.endStr ? event.endStr.split('T')[0] : event.startStr.split('T')[0],
            start_time: event.startStr.includes('T') ? event.startStr.split('T')[1].substring(0, 5) : '',
            end_time: event.endStr && event.endStr.includes('T') ? event.endStr.split('T')[1].substring(0, 5) : '',
            all_day: event.allDay,
            category: event.extendedProps.category || 'work',
            color: event.backgroundColor,
            location: event.extendedProps.location || '',
            visibility: event.extendedProps.visibility || 'public',
            department_id: event.extendedProps.department_id || null
        });
        
        // 상세 모달 대신 수정 모달 열기
        setShowEventModal(true);
    };

    const handleSubmit = async (submitData) => {
        try {
            // FormData인 경우 (파일 첨부가 있는 경우)
            const isFormData = submitData instanceof FormData;
            
            let response;
            if (selectedEvent) {
                // 수정
                if (isFormData) {
                    response = await api.put(`/events/${selectedEvent.id}`, submitData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                } else {
                    response = await api.put(`/events/${selectedEvent.id}`, formData);
                }
                toast.success('일정이 수정되었습니다.');
            } else {
                // 생성
                if (isFormData) {
                    response = await api.post('/events', submitData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                } else {
                    response = await api.post('/events', formData);
                }
                toast.success('일정이 등록되었습니다.');
            }

            setShowEventModal(false);
            setSelectedEvent(null);
            fetchEvents();
            resetForm();
        } catch (error) {
            console.error('일정 저장 실패:', error);
            toast.error('일정 저장에 실패했습니다.');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;

        try {
            await api.delete(`/events/${selectedEvent.id}`);
            toast.success('일정이 삭제되었습니다.');
            setShowDetailModal(false);
            fetchEvents();
        } catch (error) {
            console.error('일정 삭제 실패:', error);
            toast.error('일정 삭제에 실패했습니다.');
        }
    };

    const handleEdit = () => {
        const event = selectedEvent;
        setFormData({
            title: event.title,
            description: event.extendedProps.description || '',
            start_date: event.startStr.split('T')[0],
            end_date: event.endStr ? event.endStr.split('T')[0] : event.startStr.split('T')[0],
            start_time: event.startStr.includes('T') ? event.startStr.split('T')[1].substring(0, 5) : '',
            end_time: event.endStr && event.endStr.includes('T') ? event.endStr.split('T')[1].substring(0, 5) : '',
            all_day: event.allDay,
            category: event.extendedProps.category || 'work',
            color: event.backgroundColor,
            location: event.extendedProps.location || '',
            visibility: event.extendedProps.visibility || 'public',
            department_id: event.extendedProps.department_id || null
        });
        setShowDetailModal(false);
        setShowEventModal(true);
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            start_date: '',
            end_date: '',
            start_time: '',
            end_time: '',
            all_day: false,
            category: 'work',
            color: '#ff6b35',
            location: '',
            visibility: 'public',
            department_id: user?.department_id || null
        });
        setSelectedEvent(null);
    };

    const toggleCalendar = (id, type) => {
        if (type === 'personal') {
            setMyCalendars(prev => {
                const updated = prev.map(cal => 
                    cal.id === id ? { ...cal, visible: !cal.visible } : cal
                );
                // localStorage에 저장
                localStorage.setItem('myCalendars', JSON.stringify(updated));
                return updated;
            });
        } else {
            setDeptCalendars(prev => {
                const updated = prev.map(cal => 
                    cal.id === id ? { ...cal, visible: !cal.visible } : cal
                );
                // localStorage에 저장
                localStorage.setItem('deptCalendars', JSON.stringify(updated));
                return updated;
            });
        }
    };

    // 표시할 이벤트 필터링
    const getVisibleEvents = () => {
        return events.filter(event => {
            // 개인 캘린더 필터링
            if (!event.extendedProps.department_id) {
                const calendar = myCalendars.find(cal => cal.id === event.extendedProps?.category);
                return calendar?.visible !== false;
            }
            
            // 부서 캘린더 필터링
            if (event.extendedProps.visibility === 'department') {
                const dept = deptCalendars.find(d => d.id === event.extendedProps.department_id);
                return dept?.visible !== false;
            }
            
            // 전체 공개 일정은 항상 표시
            return true;
        });
    };

    // 미니 캘린더 렌더링
    const renderMiniCalendar = () => {
        const year = miniCalDate.getFullYear();
        const month = miniCalDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="mini-cal-day empty"></div>);
        }

        for (let date = 1; date <= lastDate; date++) {
            const isToday = today.getFullYear() === year && 
                           today.getMonth() === month && 
                           today.getDate() === date;
            const isSunday = (firstDay + date - 1) % 7 === 0;
            const isSaturday = (firstDay + date - 1) % 7 === 6;

            days.push(
                <div 
                    key={date} 
                    className={`mini-cal-day ${isToday ? 'today' : ''} ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''}`}
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
        <div className="naver-calendar-page">
            {/* 왼쪽 사이드바 */}
            <div className="calendar-sidebar">
                {/* 일정 생성 버튼 */}
                <button className="create-event-btn-naver" onClick={() => {
                    resetForm();
                    setShowEventModal(true);
                }}>
                    + 일정 생성
                </button>

                {/* 미니 캘린더 */}
                <div className="mini-calendar">
                    <div className="mini-cal-header">
                        <button onClick={prevMiniMonth}>‹</button>
                        <span>{miniCalDate.getFullYear()}. {String(miniCalDate.getMonth() + 1).padStart(2, '0')}</span>
                        <button onClick={nextMiniMonth}>›</button>
                    </div>
                    <div className="mini-cal-weekdays">
                        <div className="sunday">일</div>
                        <div>월</div>
                        <div>화</div>
                        <div>수</div>
                        <div>목</div>
                        <div>금</div>
                        <div className="saturday">토</div>
                    </div>
                    <div className="mini-cal-grid">
                        {renderMiniCalendar()}
                    </div>
                </div>

                {/* 내 캘린더 */}
                <div className="my-calendars">
                    <h3>내 캘린더</h3>
                    {myCalendars.map(cal => (
                        <label key={cal.id} className="calendar-item">
                            <input 
                                type="checkbox" 
                                checked={cal.visible}
                                onChange={() => toggleCalendar(cal.id, 'personal')}
                            />
                            <span className="calendar-color" style={{ backgroundColor: cal.color }}></span>
                            <span className="calendar-name">{cal.name}</span>
                        </label>
                    ))}
                </div>

                {/* 부서 캘린더 */}
                <div className="dept-calendars">
                    <h3>부서 캘린더</h3>
                    {deptCalendars.map(dept => (
                        <label key={dept.id} className="calendar-item">
                            <input 
                                type="checkbox" 
                                checked={dept.visible}
                                onChange={() => toggleCalendar(dept.id, 'department')}
                            />
                            <span className="calendar-color" style={{ backgroundColor: dept.color }}></span>
                            <span className="calendar-name">{dept.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* 메인 캘린더 */}
            <div className="calendar-main">
                <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek,timeGridDay'
                    }}
                    locale="ko"
                    events={getVisibleEvents()}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    height="100%"
                    buttonText={{
                        today: '오늘',
                        month: '월',
                        week: '주',
                        day: '일'
                    }}
                    dayMaxEvents={5}
                    moreLinkText="개"
                    dayHeaderFormat={{ weekday: 'short' }}
                    fixedWeekCount={false}
                    showNonCurrentDates={false}
                    dayCellContent={(arg) => arg.dayNumberText.replace('일', '')}
                />
            </div>

            {/* 일정 생성/수정 모달 - EventModal 사용 */}
            <EventModal
                show={showEventModal}
                onClose={() => {
                    setShowEventModal(false);
                    setSelectedEvent(null);
                }}
                onSubmit={handleSubmit}
                onDelete={selectedEvent ? handleDelete : null}
                formData={formData}
                setFormData={setFormData}
                myCalendars={myCalendars}
                deptCalendars={deptCalendars}
                isEdit={!!selectedEvent}
            />
        </div>
    );
}

export default Calendar;