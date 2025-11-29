// frontend/src/pages/ResetPasswordPage.js
import React, { useState } from 'react';
import api from '../services/api';
import { useParams, useNavigate, Link } from 'react-router-dom'; // (Import useParams)

function ResetPasswordPage() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    
    // (ดึง :token ออกมาจาก URL)
    const { token } = useParams(); 
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (newPassword.length < 6) {
            setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('รหัสผ่านใหม่ และ ยืนยันรหัสผ่าน ไม่ตรงกัน');
            return;
        }

        try {
            const { data } = await api.post(`/auth/reset-password/${token}`, { 
                newPassword 
            });
            setMessage(data.message);
            // (ถ้าสำเร็จ 3 วินาที ให้เด้งไปหน้า Login)
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen flex items-center justify-center">
            <form onSubmit={handleSubmit} className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">ตั้งรหัสผ่านใหม่</h2>

                {message && <p className="text-green-600 text-center mb-4 bg-green-100 p-3 rounded">{message}</p>}
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}

                <div className="mb-4">
                    <label className="block text-gray-700 font-semibold mb-2">รหัสผ่านใหม่</label>
                    <input 
                        type="password" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        required 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-gray-700 font-semibold mb-2">ยืนยันรหัสผ่านใหม่</label>
                    <input 
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                
                <button 
                    type="submit"
                    className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300"
                >
                    บันทึกรหัสผ่านใหม่
                </button>

                {message && (
                     <div className="text-center mt-6">
                        <Link to="/login" className="text-sm text-blue-600 hover:underline">
                            ไปหน้าเข้าสู่ระบบ
                        </Link>
                    </div>
                )}
            </form>
        </div>
    );
}

export default ResetPasswordPage;