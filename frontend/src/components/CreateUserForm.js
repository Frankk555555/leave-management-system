// frontend/src/components/CreateUserForm.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';

function CreateUserForm() {
    const [departments, setDepartments] = useState([]);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('teacher');
    const [departmentId, setDepartmentId] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const { data } = await api.get('/admin/departments');
                setDepartments(data);
                if (data.length > 0) setDepartmentId(data[0].department_id);
            } catch (error) { setError('ไม่สามารถโหลดรายชื่อภาควิชาได้ กรุณารีโหลด'); }
        };
        fetchDepartments();
    }, []);

    const handleSubmit = async (e) => {
        // ... (Logic เดิม) ...
        e.preventDefault(); setMessage(''); setError('');
        if (!username || !password || !fullName || !email || !role) { setError('กรุณากรอกข้อมูลที่จำเป็นให้ครบ'); return; }
        try {
            const newUser = { username, password, full_name: fullName, email, role, department_id: (role === 'admin' || !departmentId) ? null : parseInt(departmentId) };
            const { data } = await api.post('/admin/users', newUser);
            setMessage(data.message + ' (คุณสามารถสร้างผู้ใช้คนต่อไปได้เลย)');
            setUsername(''); setPassword(''); setFullName(''); setEmail(''); setRole('teacher');
        } catch (error) { setError(error.response?.data?.message || 'การสร้างผู้ใช้ล้มเหลว'); }
    };

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
    const labelClass = "block text-gray-700 font-semibold mb-2";

    return (
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <h4 className="text-2xl font-bold text-gray-800 mb-6">สร้างผู้ใช้ใหม่ (ลงทะเบียน)</h4>
            {message && <p className="text-green-600 mb-4 bg-green-100 p-3 rounded">{message}</p>}
            {error && <p className="text-red-600 mb-4 bg-red-100 p-3 rounded">{error}</p>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label className={labelClass}>ชื่อผู้ใช้ (Username)</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>รหัสผ่านเริ่มต้น</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} />
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>ชื่อ-นามสกุล (เต็ม)</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} />
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>อีเมล</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>สิทธิ์การใช้งาน (Role)</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
                        <option value="teacher">อาจารย์</option>
                        <option value="head">หัวหน้าภาควิชา</option>
                        <option value="admin">ผู้ดูแลระบบ</option>
                    </select>
                </div>
                {role !== 'admin' && (
                    <div>
                        <label className={labelClass}>สังกัดภาควิชา</label>
                        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputClass}>
                            {departments.length === 0 && <option>กำลังโหลด...</option>}
                            {departments.map(dep => (
                                <option key={dep.department_id} value={dep.department_id}>{dep.department_name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition duration-300">
                สร้างผู้ใช้
            </button>
        </form>
    );
}

export default CreateUserForm;