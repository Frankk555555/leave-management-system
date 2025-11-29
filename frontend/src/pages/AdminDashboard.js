// frontend/src/pages/AdminDashboard.js
import React, { useState } from 'react';
import UserManagement from '../components/UserManagement';
import CreateUserForm from '../components/CreateUserForm';
import QuotaManagement from '../components/QuotaManagement'; 
import ReportGenerator from '../components/ReportGenerator';
import StatisticsDashboard from '../components/StatisticsDashboard';

function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('stats'); 
    
    const getTabClass = (tabName) => {
        return `py-4 px-6 font-semibold rounded-t-lg transition-colors
            ${activeTab === tabName 
                ? 'text-blue-600 bg-white'
                : 'text-gray-600 hover:bg-gray-200'
            }`;
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">
                หน้าหลัก (ผู้ดูแลระบบ)
            </h1>

            {/* 2. เพิ่มปุ่มแท็บ "สร้างรายงาน" (ใช้ flex-wrap เพื่อรองรับจอเล็ก) */}
            <div className="flex flex-wrap border-b-2 border-gray-200 mb-6">
                <button className={getTabClass('stats')} onClick={() => setActiveTab('stats')}>
                    📈 สถิติภาพรวม
                </button>
                <button className={getTabClass('users')} onClick={() => setActiveTab('users')}>
                    👥 จัดการผู้ใช้
                </button>
                <button className={getTabClass('create')} onClick={() => setActiveTab('create')}>
                    ➕ สร้างผู้ใช้ใหม่
                </button>
                <button className={getTabClass('quotas')} onClick={() => setActiveTab('quotas')}>
                    📅 จัดการโควต้า
                </button>
                <button className={getTabClass('reports')} onClick={() => setActiveTab('reports')}>
                    📄 สร้างรายงาน
                </button>
            </div>

            {/* 3. เพิ่มเนื้อหาสำหรับแท็บใหม่ */}
            <div className="admin-tab-content">
                {activeTab === 'stats' && <StatisticsDashboard />}
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'create' && <CreateUserForm />}
                {activeTab === 'quotas' && <QuotaManagement />}
                {activeTab === 'reports' && <ReportGenerator />} {/* <-- เพิ่มบรรทัดนี้ */}
            </div>
        </div>
    );
}

export default AdminDashboard;