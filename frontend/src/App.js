// frontend/src/App.js
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import TeacherDashboard from './pages/TeacherDashboard';
import HeadDashboard from './pages/HeadDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';
import ProfilePage from './pages/ProfilePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage'; 
import ResetPasswordPage from './pages/ResetPasswordPage';

const HomeRedirect = () => {
    // ... (โค้ดส่วนนี้เหมือนเดิม) ...
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    switch (user.role) {
        case 'teacher': return <Navigate to="/dashboard/teacher" replace />;
        case 'head': return <Navigate to="/dashboard/head" replace />;
        case 'admin': return <Navigate to="/dashboard/admin" replace />;
        default: return <Navigate to="/login" replace />;
    }
};

function App() {
    const { user } = useAuth();
    const location = useLocation();
    const isLoginPage = location.pathname === '/login';

    return (
        <div className={isLoginPage ? 'bg-gray-100' : 'bg-gray-50 min-h-screen'}>
            
            {/* --- VVVV นี่คือจุดที่แก้ไข VVVV --- */}
            {/* เราจะแสดง Navbar ก็ต่อเมื่อ "user" (object) มีค่าเท่านั้น */}
            {/* (ไม่ใช่แค่เช็กว่า "ไม่อยู่หน้า login") */}
            {user && <Navbar />}

            <main className={!isLoginPage ? "max-w-7xl mx-auto p-4 md:p-8" : ""}>
                <Routes>
                    <Route path="/login" element={user ? <HomeRedirect /> : <LoginPage />} />
                    
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

                    <Route path="/dashboard/teacher" element={
                        <ProtectedRoute role="teacher"> <TeacherDashboard /> </ProtectedRoute>
                    } />
                    <Route path="/dashboard/head" element={
                        <ProtectedRoute role="head"> <HeadDashboard /> </ProtectedRoute>
                    } />
                    <Route path="/dashboard/admin" element={
                        <ProtectedRoute role="admin"> <AdminDashboard /> </ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                    <ProtectedRoute> <ProfilePage /> </ProtectedRoute>
                    } />
                    
                    <Route path="/" element={<HomeRedirect />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;