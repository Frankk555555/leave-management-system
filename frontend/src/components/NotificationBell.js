// frontend/src/components/NotificationBell.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './NotificationBell.css'; 

function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        try {
            const { data } = await api.get('/notifications');
            setNotifications(data);
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); 
        return () => clearInterval(interval);
    }, []);

    const handleClick = (notification) => {
        setIsOpen(false); 
        markAsRead(notification.notification_id);
        navigate(notification.link || '/'); 
    };

    const markAsRead = async (id) => {
        try {
            await api.put(`/notifications/read/${id}`);
            setNotifications(prev => prev.filter(n => n.notification_id !== id));
        } catch (error) {
            console.error('Failed to mark as read', error);
        }
    };

    return (
        <div className="notification-bell">
            <button className="bell-button" onClick={() => setIsOpen(!isOpen)}>
                <span>🔔</span>
                {notifications.length > 0 && (
                    <span className="notification-badge">{notifications.length}</span>
                )}
            </button>

            {isOpen && (
                <div className="notification-dropdown">
                    {notifications.length === 0 ? (
                        <div className="notification-item">ไม่มีการแจ้งเตือนใหม่</div>
                    ) : (
                        notifications.map(noti => (
                            <div 
                                key={noti.notification_id} 
                                className="notification-item"
                                onClick={() => handleClick(noti)}
                            >
                                {noti.message}
                                <span className="notification-time">
                                    {/* แปลงเวลาให้เป็นไทย */}
                                    {new Date(noti.created_at).toLocaleString('th-TH')}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default NotificationBell;