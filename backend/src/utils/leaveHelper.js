// backend/src/utils/leaveHelper.js
import pool from '../config/db.js';

/**
 * คำนวณจำนวนวันลา (แบบง่าย, ไม่นับวันหยุด)
 * @param {string} startDate - 'YYYY-MM-DD'
 * @param {string} endDate - 'YYYY-MM-DD'
 * @returns {number} จำนวนวัน
 */
export const calculateLeaveDays = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // (DATEDIFF + 1)
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays + 1;
};

/**
 * ดึงข้อมูลโควต้าคงเหลือ
 * @param {number} userId - ID ของผู้ใช้
 * @param {string} leaveType - 'sick', 'personal', 'vacation'
 * @param {number} year - ปี (เช่น 2025)
 * @returns {Promise<object>} e.g., { total: 10, used: 2, remaining: 8 }
 */
export const getLeaveBalance = async (userId, leaveType, year) => {
    const connection = await pool.getConnection();
    try {
        // 1. ดึงโควต้าทั้งหมด (Total)
        const [quotaRows] = await connection.query(
            'SELECT total_days FROM leave_quotas WHERE user_id = ? AND leave_type = ? AND year = ?',
            [userId, leaveType, year]
        );
        
        const total = quotaRows.length > 0 ? quotaRows[0].total_days : 0;

        // 2. คำนวณวันที่ใช้ไปแล้ว (Used)
        // (นับเฉพาะใบลาที่ 'approved' และอยู่ใน 'year' นั้นๆ)
        const [usedRows] = await connection.query(
            `SELECT 
                start_date, end_date 
             FROM leave_requests 
             WHERE user_id = ? 
               AND leave_type = ? 
               AND status = 'approved' 
               AND YEAR(start_date) = ?`,
            [userId, leaveType, year]
        );

        let used = 0;
        usedRows.forEach(req => {
            used += calculateLeaveDays(req.start_date, req.end_date);
        });

        // 3. คำนวณคงเหลือ (Remaining)
        const remaining = total - used;

        return { total, used, remaining };

    } catch (error) {
        console.error("Error in getLeaveBalance:", error);
        return { total: 0, used: 0, remaining: 0 };
    } finally {
        connection.release();
    }
};

/**
 * ดึงโควต้าคงเหลือ "ทั้งหมด" (สำหรับ Frontend)
 */
export const getAllLeaveBalances = async (userId, year) => {
    const types = ['sick', 'personal', 'vacation'];
    const balances = {};
    
    // (เราใช้ Promise.all เพื่อให้มันทำงานพร้อมกัน 3 ประเภท)
    await Promise.all(types.map(async (type) => {
        balances[type] = await getLeaveBalance(userId, type, year);
    }));
    
    return balances;
};