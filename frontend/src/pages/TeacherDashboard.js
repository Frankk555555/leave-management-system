// frontend/src/pages/TeacherDashboard.js
import React from 'react';
import LeaveRequestForm from '../components/LeaveRequestForm';
import LeaveHistoryTable from '../components/LeaveHistoryTable';
import LeaveBalance from '../components/LeaveBalance';
import LeaveCalendar from '../components/LeaveCalendar'; // <-- 1. Import

function TeacherDashboard() {
    const [refreshKey, setRefreshKey] = React.useState(0);
    const onFormSubmitSuccess = () => { setRefreshKey(oldKey => oldKey + 1); };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">หน้าหลัก (อาจารย์)</h1>
            <LeaveBalance refreshKey={refreshKey} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <LeaveRequestForm onFormSubmitSuccess={onFormSubmitSuccess} />
                <LeaveHistoryTable refreshKey={refreshKey} />
            </div>

            {/* --- 2. เพิ่มปฏิทิน --- */}
            <div className="mt-8">
                <LeaveCalendar />
            </div>
        </div>
    );
}
export default TeacherDashboard;