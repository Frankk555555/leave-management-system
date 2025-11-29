// frontend/src/components/LeaveHistoryTable.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { translateStatus, translateLeaveType } from '../utils/translationHelper';

function LeaveHistoryTable({ refreshKey }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            try { setLoading(true); const { data } = await api.get('/leave/my-history'); setHistory(data); setError(''); } 
            catch (err) { setError('ไม่สามารถดึงประวัติการลาได้'); } 
            finally { setLoading(false); }
        };
        fetchHistory();
    }, [refreshKey]);

    if (loading) return <p className="text-gray-500">กำลังโหลดประวัติ...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    const thClass = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
    const tdClass = "px-6 py-4 whitespace-nowrap text-sm text-gray-700";

    // Helper สำหรับสีสถานะ (Tailwind)
    const getStatusBadge = (status) => {
        const baseClass = "px-2 inline-flex text-xs leading-5 font-semibold rounded-full";
        switch (status) {
            case 'approved': return `${baseClass} bg-green-100 text-green-800`;
            case 'rejected': return `${baseClass} bg-red-100 text-red-800`;
            default: return `${baseClass} bg-yellow-100 text-yellow-800`;
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">ประวัติการลาของฉัน</h3>
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className={thClass}>ประเภทการลา</th>
                        <th className={thClass}>ช่วงวันที่ลา</th>
                        <th className={thClass}>สถานะ</th>
                        <th className={thClass}>หมายเหตุจากหัวหน้า</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {history.length === 0 ? (
                        <tr><td colSpan="4" className={`${tdClass} text-center`}>ไม่พบประวัติการลา</td></tr>
                    ) : (
                        history.map(req => (
                            <tr key={req.request_id}>
                                <td className={tdClass}>{translateLeaveType(req.leave_type)}</td>
                                <td className={tdClass}>
                                    {new Date(req.start_date).toLocaleDateString('th-TH')} - {new Date(req.end_date).toLocaleDateString('th-TH')}
                                </td>
                                <td className={tdClass}>
                                    <span className={getStatusBadge(req.status)}>
                                        {translateStatus(req.status)}
                                    </span>
                                </td>
                                <td className={`${tdClass} whitespace-normal`}>{req.head_remarks || '-'}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default LeaveHistoryTable;