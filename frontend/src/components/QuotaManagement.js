// frontend/src/components/QuotaManagement.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';

function QuotaManagement() {
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [year, setYear] = useState(new Date().getFullYear() + 1); 
    const [sickDays, setSickDays] = useState(10);
    const [personalDays, setPersonalDays] = useState(5);
    const [vacationDays, setVacationDays] = useState(10);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // ... (Logic เดิม: fetchUsers, useEffect[selectedUserId, year], handleSubmit) ...
    useEffect(() => { const fetchUsers = async () => { try { const { data } = await api.get('/admin/users'); const nonAdmins = data.filter(u => u.role !== 'admin'); setUsers(nonAdmins); if (nonAdmins.length > 0) { setSelectedUserId(nonAdmins[0].user_id); } } catch (err) { setError('ไม่สามารถดึงรายชื่อผู้ใช้ได้'); } }; fetchUsers(); }, []);
    useEffect(() => { if (!selectedUserId || !year) return; const fetchQuotas = async () => { try { setLoading(true); setMessage(''); setError(''); const { data } = await api.get(`/admin/quotas/${selectedUserId}/${year}`); setSickDays(data.sick || 10); setPersonalDays(data.personal || 5); setVacationDays(data.vacation || 10); } catch (err) { setSickDays(10); setPersonalDays(5); setVacationDays(10); } finally { setLoading(false); } }; fetchQuotas(); }, [selectedUserId, year]);
    const handleSubmit = async (e) => { e.preventDefault(); setMessage(''); setError(''); try { const quotas = { sick: parseInt(sickDays), personal: parseInt(personalDays), vacation: parseInt(vacationDays) }; const { data } = await api.post('/admin/quotas/batch', { userId: selectedUserId, year: parseInt(year), quotas: quotas }); setMessage(data.message + ` (สำหรับปี ${year})`); } catch (err) { setError(err.response?.data?.message || 'ไม่สามารถบันทึกโควต้าได้'); } };

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
    const labelClass = "block text-gray-700 font-semibold mb-2";

    return (
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <h4 className="text-2xl font-bold text-gray-800 mb-6">จัดการโควต้าการลา</h4>
            {message && <p className="text-green-600 mb-4 bg-green-100 p-3 rounded">{message}</p>}
            {error && <p className="text-red-600 mb-4 bg-red-100 p-3 rounded">{error}</p>}
            
            {/* --- ช่องเลือก User และ ปี --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label className={labelClass}>เลือกผู้ใช้</label>
                    <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} required className={inputClass}>
                        {users.length === 0 && <option>กำลังโหลดผู้ใช้...</option>}
                        {users.map(user => (
                            <option key={user.user_id} value={user.user_id}>
                                {user.full_name} ({user.role})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>สำหรับปี (ค.ศ.)</label>
                    <input 
                        type="number" 
                        value={year} 
                        onChange={(e) => setYear(e.target.value)} 
                        required 
                        className={inputClass}
                    />
                </div>
            </div>

            {/* --- ช่องกรอกโควต้า --- */}
            {loading ? <p className="text-gray-500">กำลังโหลดโควต้า...</p> : (
                <>
                    <hr className="my-6 border-gray-200" />
                    <p className="text-lg font-semibold text-gray-800 mb-4">
                        กำหนดจำนวนวันลาทั้งหมดสำหรับปี {year}:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className={labelClass}>โควต้าลาป่วย (วัน)</label>
                            <input type="number" value={sickDays} onChange={(e) => setSickDays(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>โควต้าลากิจ (วัน)</label>
                            <input type="number" value={personalDays} onChange={(e) => setPersonalDays(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>โควต้าลาพักผ่อน (วัน)</label>
                            <input type="number" value={vacationDays} onChange={(e) => setVacationDays(e.target.value)} className={inputClass} />
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300">
                        บันทึกโควต้า
                    </button>
                </>
            )}
        </form>
    );
}

export default QuotaManagement;