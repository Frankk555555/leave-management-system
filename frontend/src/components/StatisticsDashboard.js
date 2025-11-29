// frontend/src/components/StatisticsDashboard.js
import React, { useState, useEffect } from 'react';
import { Bar, Pie } from 'react-chartjs-2'; // (เราจะใช้ Pie chart สำหรับกราฟเดิม)
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { translateLeaveType } from '../utils/translationHelper'; 
import api from '../services/api';

// (Register Chart.js components)
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// --- (Component ย่อย 1: กราฟประเภทการลา) ---
function LeaveTypeChart() {
    const [chartData, setChartData] = useState(null);
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get('/admin/stats'); 
                if (data && data.length > 0) {
                    setChartData({
                        labels: data.map(d => translateLeaveType(d.leave_type)),
                        datasets: [{
                            label: 'จำนวนการลา (ครั้ง)',
                            data: data.map(d => d.count),
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.6)', // Sick
                                'rgba(54, 162, 235, 0.6)', // Personal
                                'rgba(255, 206, 86, 0.6)'  // Vacation
                            ],
                        }],
                    });
                }
            } catch (error) { console.error("Failed to fetch stats", error); }
        };
        fetchStats();
    }, []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">สัดส่วนการลา (ตามประเภท)</h3>
            {chartData ? <Pie data={chartData} /> : <p>กำลังโหลด...</p>}
        </div>
    );
}

// --- (Component ย่อย 2: กราฟตามภาควิชา) ---
function DeptLeaveChart() {
    const [chartData, setChartData] = useState(null);
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get('/admin/stats/by-department');
                if (data && data.length > 0) {
                    setChartData({
                        labels: data.map(d => d.department_name),
                        datasets: [{
                            label: 'จำนวนการลาที่อนุมัติ (ครั้ง)',
                            data: data.map(d => d.leave_count),
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        }],
                    });
                }
            } catch (error) { console.error("Failed to fetch dept stats", error); }
        };
        fetchStats();
    }, []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">สถิติการลา (ตามภาควิชา)</h3>
            {chartData ? <Bar data={chartData} /> : <p>กำลังโหลด...</p>}
        </div>
    );
}

// --- (Component ย่อย 3: ลิสต์คนใช้โควต้าหมด) ---
function MaxQuotaList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data } = await api.get('/admin/stats/maxed-quota');
                setUsers(data);
            } catch (error) { console.error("Failed to fetch maxed quota users", error); } 
            finally { setLoading(false); }
        };
        fetchUsers();
    }, []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
                📋 ผู้ใช้โควต้าพักผ่อน 100% (ปี {new Date().getFullYear()})
            </h3>
            {loading ? <p>กำลังคำนวณ...</p> : (
                users.length === 0 ? (
                    <p className="text-gray-600">ยังไม่มีผู้ใช้โควต้าพักผ่อนจนหมด</p>
                ) : (
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                        {users.map((name, index) => (
                            <li key={index}>{name}</li>
                        ))}
                    </ul>
                )
            )}
        </div>
    );
}

// --- (Component หลัก ที่รวม 3 ส่วน) ---
function StatisticsDashboard() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LeaveTypeChart />
                <DeptLeaveChart />
            </div>
            <div>
                <MaxQuotaList />
            </div>
        </div>
    );
}

export default StatisticsDashboard;