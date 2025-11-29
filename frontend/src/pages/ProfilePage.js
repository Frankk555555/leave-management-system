// frontend/src/pages/ProfilePage.js
import React, { useState } from 'react';
import api from '../services/api';

function ProfilePage() {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

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
            const { data } = await api.post('/auth/change-password', { 
                oldPassword, 
                newPassword 
            });
            setMessage(data.message + ' (ระบบจะใช้รหัสใหม่นี้ในการล็อกอินครั้งถัดไป)');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
        }
    };

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
    const labelClass = "block text-gray-700 font-semibold mb-2";

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">
                โปรไฟล์ของฉัน / เปลี่ยนรหัสผ่าน
            </h1>

            <form onSubmit={handleSubmit}>
                {message && <p className="text-green-600 mb-4 bg-green-100 p-3 rounded">{message}</p>}
                {error && <p className="text-red-600 mb-4 bg-red-100 p-3 rounded">{error}</p>}

                <div className="mb-4">
                    <label className={labelClass}>รหัสผ่านเดิม</label>
                    <input 
                        type="password" 
                        value={oldPassword} 
                        onChange={(e) => setOldPassword(e.target.value)} 
                        required 
                        className={inputClass} 
                    />
                </div>
                <hr className="my-6 border-gray-200" />
                <div className="mb-4">
                    <label className={labelClass}>รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
                    <input 
                        type="password" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        required 
                        className={inputClass} 
                    />
                </div>
                <div className="mb-6">
                    <label className={labelClass}>ยืนยันรหัสผ่านใหม่</label>
                    <input 
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                        className={inputClass} 
                    />
                </div>
                
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300">
                    บันทึกการเปลี่ยนแปลงรหัสผ่าน
                </button>
            </form>
        </div>
    );
}

export default ProfilePage;