// backend/src/utils/leaveHelper.js
import pool from '../config/db.js';

/**
 * คำนวณจำนวนวันลา (รองรับครึ่งวัน)
 */
export const calculateLeaveDays = (startDate, endDate, duration) => {
    // ถ้าไม่ใช่เต็มวัน ให้คืนค่า 0.5 ทันที
    if (duration !== 'full') {
        return 0.5;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
};

/**
 * ดึงข้อมูลโควต้าคงเหลือ
 */
export const getLeaveBalance = async (userId, leaveType, year) => {
    const connection = await pool.getConnection();
    try {
        const [quotaRows] = await connection.query(
            'SELECT total_days FROM leave_quotas WHERE user_id = ? AND leave_type = ? AND year = ?',
            [userId, leaveType, year]
        );
        
        const total = quotaRows.length > 0 ? quotaRows[0].total_days : 0;

        // ดึงใบลาที่อนุมัติแล้ว พร้อม duration
        const [usedRows] = await connection.query(
            `SELECT start_date, end_date, duration 
             FROM leave_requests 
             WHERE user_id = ? 
               AND leave_type = ? 
               AND status = 'approved' 
               AND YEAR(start_date) = ?`,
            [userId, leaveType, year]
        );

        let used = 0;
        usedRows.forEach(req => {
            // ส่ง duration ไปคำนวณด้วย
            used += calculateLeaveDays(req.start_date, req.end_date, req.duration);
        });

        const remaining = total - used;
        return { total, used, remaining };

    } catch (error) {
        console.error("Error in getLeaveBalance:", error);
        return { total: 0, used: 0, remaining: 0 };
    } finally {
        connection.release();
    }
};

// (ฟังก์ชัน getAllLeaveBalances เหมือนเดิม ไม่ต้องแก้)
export const getAllLeaveBalances = async (userId, year) => {
    const types = ['sick', 'personal', 'vacation'];
    const balances = {};
    await Promise.all(types.map(async (type) => {
        balances[type] = await getLeaveBalance(userId, type, year);
    }));
    return balances;
};