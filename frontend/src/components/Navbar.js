// frontend/src/components/Navbar.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom'; // <-- 1. Import Link
import { translateRole } from '../utils/translationHelper';
import api from '../services/api';

// (ส่วน NotificationBell ... เหมือนเดิม)
function NotificationBell() {
    // ... (โค้ดทั้งหมดของ NotificationBell) ...
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const fetchNotifications = async () => { try { const { data } = await api.get('/notifications'); setNotifications(data); } catch (error) { console.error('Failed to fetch notifications', error); } };
    useEffect(() => { fetchNotifications(); const interval = setInterval(fetchNotifications, 60000); return () => clearInterval(interval); }, []);
    const handleClick = (notification) => { setIsOpen(false); markAsRead(notification.notification_id); navigate(notification.link || '/'); };
    const markAsRead = async (id) => { try { await api.put(`/notifications/read/${id}`); setNotifications(prev => prev.filter(n => n.notification_id !== id)); } catch (error) { console.error('Failed to mark as read', error); } };
    return (
        <div className="relative mx-4">
            <button className="relative text-gray-200 hover:text-white" onClick={() => setIsOpen(!isOpen)}>
                <span className="text-2xl">🔔</span>
                {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                        {notifications.length}
                    </span>
                )}
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-xl z-50">
                    <div className="p-4 text-gray-800 font-semibold border-b">การแจ้งเตือน</div>
                    {notifications.length === 0 ? (
                        <div className="p-4 text-sm text-gray-600">ไม่มีการแจ้งเตือนใหม่</div>
                    ) : (
                        notifications.map(noti => (
                            <div key={noti.notification_id} className="p-4 border-b text-gray-700 hover:bg-gray-100 cursor-pointer" onClick={() => handleClick(noti)}>
                                <p className="text-sm">{noti.message}</p>
                                <span className="text-xs text-gray-500">{new Date(noti.created_at).toLocaleString('th-TH')}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// (ส่วน Navbar)
function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <nav className="bg-gray-800 text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    
                    <div className="flex-shrink-0">
                        <h2 className="text-xl font-bold">
                            ระบบจัดการการลา
                            <span className="text-sm font-light text-gray-300 ml-2">
                                (สิทธิ์: {translateRole(user.role)})
                            </span>
                        </h2>
                    </div>

                    <div className="flex items-center">
                        
                        {/* --- VVVV 2. แก้ไขตรงนี้ VVVV --- */}
                        <Link to="/profile" className="text-gray-300 text-sm hidden md:block hover:text-white hover:underline px-3 py-2 rounded-md">
                            ยินดีต้อนรับ, {user.full_name || user.username}
                        </Link>
                        {/* --- ^^^^ ------------------ ^^^^ --- */}
                        
                        <NotificationBell />
                        
                        <button 
                            onClick={handleLogout}
                            className="ml-2 bg-red-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition"
                        >
                            ออกจากระบบ
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;