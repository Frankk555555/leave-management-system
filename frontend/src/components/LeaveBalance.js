// frontend/src/components/LeaveBalance.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { translateLeaveType } from '../utils/translationHelper'; 

function LeaveBalance({ refreshKey }) {
    const [balances, setBalances] = useState(null);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                setLoading(true);
                setYear(new Date().getFullYear()); 
                const { data } = await api.get('/leave/my-balance');
                setBalances(data);
            } catch (error) {
                console.error('Failed to fetch leave balance', error);
            } finally {
                setLoading(false);
            }
        };
        fetchBalance();
    }, [refreshKey]);

    if (loading) return <p className="text-gray-500">กำลังโหลดโควต้า...</p>;
    if (!balances) return <p className="text-red-500">ไม่สามารถโหลดโควต้าได้</p>;

    const thClass = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
    const tdClass = "px-6 py-4 whitespace-nowrap text-sm text-gray-700";

    return (
        // --- ใช้ Card UI ---
        <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
            <h4 className="text-xl font-bold text-gray-800 mb-4">
                โควต้าการลาของฉัน (ปี {year})
            </h4>
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className={thClass}>ประเภทการลา</th>
                        <th className={thClass}>ทั้งหมด (วัน)</th>
                        <th className={thClass}>ใช้ไปแล้ว</th>
                        <th classNameclassName={thClass}>คงเหลือ</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(balances).map(([type, data]) => (
                        <tr key={type} className="hover:bg-gray-50">
                            <td className={tdClass}>
                                {translateLeaveType(type)}
                            </td>
                            <td className={tdClass}>{data.total}</td>
                            <td className={tdClass}>{data.used}</td>
                            <td className={`${tdClass} font-bold text-gray-900`}>
                                {data.remaining}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default LeaveBalance;