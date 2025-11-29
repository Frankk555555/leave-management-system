// frontend/src/components/PendingApprovalList.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { translateLeaveType } from '../utils/translationHelper'; 

function PendingApprovalList() {
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [remarks, setRemarks] = useState({});

    // ... (Logic เดิม: fetchPending, handleRemarksChange, handleApprove, handleReject) ...
    const fetchPending = async () => { try { setLoading(true); const { data } = await api.get('/leave/head/pending'); setPending(data); setError(''); } catch (err) { setError('ไม่สามารถดึงรายการที่รออนุมัติได้'); } finally { setLoading(false); } };
    useEffect(() => { fetchPending(); }, []);
    const handleRemarksChange = (id, value) => { setRemarks(prev => ({ ...prev, [id]: value })); };
    const handleApprove = async (id) => { try { await api.put(`/leave/head/approve/${id}`, { remarks: remarks[id] || '' }); fetchPending(); } catch (err) { alert('อนุมัติไม่สำเร็จ'); } };
    const handleReject = async (id) => { if (!remarks[id] || remarks[id].trim() === '') { alert('กรุณาระบุหมายเหตุ'); return; } try { await api.put(`/leave/head/reject/${id}`, { remarks: remarks[id] }); fetchPending(); } catch (err) { alert('ไม่อนุมัติไม่สำเร็จ'); } };

    if (loading) return <p className="text-gray-500">กำลังโหลดรายการ...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    const thClass = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
    const tdClass = "px-6 py-4 text-sm text-gray-700"; // (เอา whitespace-nowrap ออกบางส่วน)

    return (
        <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">ใบลาที่รออนุมัติ</h3>
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className={thClass}>ชื่อผู้ยื่นลา</th>
                        <th className={thClass}>ประเภท/เหตุผล</th>
                        <th className={thClass}>ช่วงวันที่ลา</th>
                        <th className={thClass}>ไฟล์แนบ</th>
                        <th className={thClass}>หมายเหตุ (จากคุณ)</th>
                        <th className={thClass}>ดำเนินการ</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {pending.length === 0 ? (
                        <tr><td colSpan="6" className={`${tdClass} text-center`}>ไม่มีรายการที่รออนุมัติ</td></tr>
                    ) : (
                        pending.map(req => (
                            <tr key={req.request_id} className="hover:bg-gray-50">
                                <td className={`${tdClass} whitespace-nowrap`}>{req.applicant_name}</td>
                                <td className={tdClass}>
                                    <div className="font-medium">{translateLeaveType(req.leave_type)}</div>
                                    <div className="text-xs text-gray-500">{req.reason}</div>
                                </td>
                                <td className={`${tdClass} whitespace-nowrap`}>
                                    {new Date(req.start_date).toLocaleDateString('th-TH')} - {new Date(req.end_date).toLocaleDateString('th-TH')}
                                </td>
                                <td className={tdClass}>
                                    {req.file_path ? (
                                        <a href={`http://localhost:5000/${req.file_path}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">
                                            ดูไฟล์
                                        </a>
                                    ) : '-'}
                                </td>
                                <td className={tdClass}>
                                    <input 
                                        type="text" 
                                        placeholder="เพิ่มหมายเหตุ..."
                                        value={remarks[req.request_id] || ''}
                                        onChange={(e) => handleRemarksChange(req.request_id, e.target.value)}
                                        className="w-full max-w-xs px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </td>
                                <td className={`${tdClass} whitespace-nowrap`}>
                                    <button onClick={() => handleApprove(req.request_id)} className="mr-2 px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition">
                                        อนุมัติ
                                    </button>
                                    <button onClick={() => handleReject(req.request_id)} className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition">
                                        ไม่อนุมัติ
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default PendingApprovalList;