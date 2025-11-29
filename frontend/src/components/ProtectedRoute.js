import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, role }) => {
    const { user } = useAuth();

    if (!user) {
        // ไม่ได้ล็อกอิน
        return <Navigate to="/login" replace />;
    }

    if (role && user.role !== role) {
        // ล็อกอินแล้ว แต่ Role ไม่ตรง
        // (อาจ redirect ไปหน้า dashboard ของตัวเอง หรือหน้า "Access Denied")
        console.warn(`Access denied. Required: ${role}, User has: ${user.role}`);
        return <Navigate to="/" replace />; 
    }

    return children;
};

export default ProtectedRoute;