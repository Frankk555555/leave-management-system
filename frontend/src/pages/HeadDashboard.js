// frontend/src/pages/HeadDashboard.js
import React from 'react';
import PendingApprovalList from '../components/PendingApprovalList';
import LeaveCalendar from '../components/LeaveCalendar'; // <-- Import ปฏิทิน

function HeadDashboard() {
    return (
        <div>
            <h1>หน้าหลัก (หัวหน้าภาควิชา)</h1>
            <PendingApprovalList />
            <LeaveCalendar />
        </div>
    );
}

export default HeadDashboard;