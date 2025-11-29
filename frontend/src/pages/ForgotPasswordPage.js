// frontend/src/pages/ForgotPasswordPage.js
import React, { useState } from 'react';
import api from '../services/api';
import { Link } from 'react-router-dom';

function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        try {
            // (Backend จะส่ง message "ดู Console...")
            const { data } = await api.post('/auth/forgot-password', { email });
            setMessage(data.message);
        } catch (err) {
            setError('เกิดข้อผิดพลาด กรุณาลองอีกครั้ง');
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen flex items-center justify-center">
            <form onSubmit={handleSubmit} className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">ลืมรหัสผ่าน</h2>
                <p className="text-center text-gray-600 mb-6">
                    กรอกอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
                </p>

                {message && <p className="text-green-600 text-center mb-4 bg-green-100 p-3 rounded">{message}</p>}
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}

                <div className="mb-4">
                    <label className="block text-gray-700 font-semibold mb-2">อีเมล</label>
                    <input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                
                <button 
                    type="submit"
                    className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300"
                >
                    รีเซ็ตรหัสผ่าน
                </button>

                <div className="text-center mt-6">
                    <Link to="/login" className="text-sm text-blue-600 hover:underline">
                        กลับไปหน้าเข้าสู่ระบบ
                    </Link>
                </div>
            </form>
        </div>
    );
}

export default ForgotPasswordPage;