// frontend/src/components/UserManagement.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { translateRole } from '../utils/translationHelper';

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [error, setError] = useState(''); 

    useEffect(() => { fetchUsers(); }, []);
    const fetchUsers = async () => { try { const { data } = await api.get('/admin/users'); setUsers(data); } catch (error) { setError('ไม่สามารถโหลดรายชื่อผู้ใช้ได้'); } };
    const handleDelete = async (userId) => { if (window.confirm('คุณแน่ใจหรือไม่?')) { try { await api.delete(`/admin/users/${userId}`); fetchUsers(); } catch (error) { alert('ลบไม่สำเร็จ'); } } };
    const handleResetPassword = async (userId, username) => { const newPass = prompt(`รหัสใหม่สำหรับ ${username}:`); if (newPass && newPass.length >= 6) { try { await api.put(`/admin/users/${userId}/reset-password`, { newPassword: newPass }); alert('สำเร็จ'); } catch (e) { alert('ไม่สำเร็จ'); } } };

    const thClass = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
    const tdClass = "px-6 py-4 whitespace-nowrap text-sm text-gray-700";

    return (
        <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
            <h4 className="text-xl font-bold text-gray-800 mb-4">ผู้ใช้ทั้งหมดในระบบ</h4>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className={thClass}>ชื่อ-นามสกุล</th>
                        <th className={thClass}>Username</th>
                        <th className={thClass}>สิทธิ์</th>
                        <th className={thClass}>ภาควิชา</th>
                        <th className={thClass}>การดำเนินการ</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {users.map(user => (
                        <tr key={user.user_id} className="hover:bg-gray-50">
                            <td className={tdClass}>{user.full_name}</td>
                            <td className={tdClass}>{user.username}</td>
                            <td className={tdClass}>
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                    {translateRole(user.role)}
                                </span>
                            </td>
                            <td className={tdClass}>{user.department_name || '-'}</td>
                            <td className={tdClass}>
                                <button onClick={() => handleResetPassword(user.user_id, user.username)} className="text-yellow-600 hover:text-yellow-900 mr-4 font-medium">
                                    รีเซ็ตรหัส
                                </button>
                                <button onClick={() => handleDelete(user.user_id)} className="text-red-600 hover:text-red-900 font-medium">
                                    ลบ
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default UserManagement;