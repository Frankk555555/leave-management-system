// frontend/src/pages/LoginPage.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(username, password);
            navigate('/'); 
        } catch (error) {
            setError(error.response?.data?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-sans text-gray-900">
            
            {/* --- ส่วนที่ 1: ด้านซ้าย (รูปภาพ + ข้อความ) --- 
                แสดงเฉพาะบนจอใหญ่ (lg:flex), ซ่อนบนมือถือ (hidden)
            */}
            <div 
                className="hidden lg:flex w-1/2 bg-cover bg-center relative items-center justify-center"
                style={{ backgroundColor: "#1E40AF", backgroundSize: 'cover', backgroundPosition: 'center'
                }}
            >
                {/* Overlay สีดำจางๆ เพื่อให้อ่านตัวหนังสือออก */}
                <div className="absolute inset-0 bg-black opacity-50"></div>
                
                <div className="relative z-10 text-white p-12 text-center max-w-lg">
                    <h1 className="text-5xl font-bold mb-6 tracking-tight ">
                        Leave Management System
                    </h1>
                    <p className="text-lg text-gray-200 leading-relaxed">
                        ระบบจัดการการลาออนไลน์สำหรับบุคลากร <br/>
                    </p>
                </div>
            </div>

            {/* --- ส่วนที่ 2: ด้านขวา (แบบฟอร์ม) --- */}
            <div className="w-full lg:w-1/2 flex justify-center items-center bg-gray-50 p-8">
                <div className="max-w-md w-full bg-white p-8 lg:p-10 rounded-2xl shadow-2xl transform transition-all hover:scale-[1.01] duration-500 ease-in-out border border-gray-100">
                    
                    {/* Logo หรือ Icon หัวข้อ */}
                    <div className="text-center mb-10">
                        <div className="inline-block p-4 rounded-full bg-blue-50 mb-4">
                             {/* Icon มหาวิทยาลัย (SVG) */}
                            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-800">ยินดีต้อนรับ</h2>
                        <p className="text-gray-500 mt-2 text-sm">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
                    </div>

                    {error && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r flex items-center">
                            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* ช่อง Username */}
                        <div>
                            <label className="block text-gray-700 text-sm font-semibold mb-2 ml-1">ชื่อผู้ใช้</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    {/* Icon User */}
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                </div>
                                <input 
                                    type="text" 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)} 
                                    required 
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
                                    placeholder="กรอกชื่อผู้ใช้ของคุณ"
                                />
                            </div>
                        </div>
                        
                        {/* ช่อง Password */}
                        <div>
                            <div className="flex justify-between items-center mb-2 ml-1">
                                <label className="block text-gray-700 text-sm font-semibold">รหัสผ่าน</label>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    {/* Icon Lock */}
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                </div>
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    required 
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="text-right mt-2">
                                <Link to="/forgot-password" class="text-xs font-medium text-blue-600 hover:text-blue-500 transition">
                                    ลืมรหัสผ่าน?
                                </Link>
                            </div>
                        </div>
                        
                        {/* ปุ่ม Login */}
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg 
                                hover:from-blue-700 hover:to-blue-800 hover:shadow-xl hover:-translate-y-0.5 
                                focus:ring-4 focus:ring-blue-300 transition duration-300 transform
                                ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}
                            `}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    กำลังตรวจสอบ...
                                </span>
                            ) : 'เข้าสู่ระบบ'}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-gray-500">
                            ยังไม่มีบัญชี? <span className="text-gray-400 cursor-not-allowed">กรุณาติดต่อผู้ดูแลระบบ</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;