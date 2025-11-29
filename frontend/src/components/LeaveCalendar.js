// frontend/src/components/LeaveCalendar.js
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import api from '../services/api';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// --- ตั้งค่า Localizer ให้ใช้ moment (ที่เรา import 'th' ไว้) ---
const localizer = momentLocalizer(moment);

function LeaveCalendar() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setLoading(true);
                const { data } = await api.get('/leave/calendar-events');
                
                // (Backend ส่ง Date object มาแล้ว แต่เผื่อมาเป็น String)
                const formattedEvents = data.map(event => ({
                    ...event,
                    start: new Date(event.start),
                    end: new Date(event.end),
                }));
                
                setEvents(formattedEvents);
            } catch (error) {
                console.error("Failed to fetch calendar events:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    if (loading) {
        return <p className="text-gray-500">กำลังโหลดปฏิทิน...</p>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">ปฏิทินการลา</h3>
            
            {/* (เราต้องกำหนดความสูงให้ปฏิทินเสมอ) */}
            <div style={{ height: '600px' }}>
                <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    culture='th' // <-- บอกปฏิทินให้ใช้ภาษาไทย
                    messages={{
                        today: 'วันนี้',
                        next: 'ถัดไป',
                        previous: 'ก่อนหน้า',
                        month: 'เดือน',
                        week: 'สัปดาห์',
                        day: 'วัน',
                        agenda: 'กำหนดการ'
                    }}
                    style={{ height: '100%' }}
                />
            </div>
        </div>
    );
}

export default LeaveCalendar;