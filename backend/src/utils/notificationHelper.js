// backend/src/utils/notificationHelper.js
import pool from '../config/db.js';

/**
 * สร้างการแจ้งเตือนใหม่ในฐานข้อมูล
 * @param {number} userId - ID ของผู้ใช้ที่จะ "ได้รับ" การแจ้งเตือน
 * @param {string} message - ข้อความแจ้งเตือน
 * @param {string} link - ลิงก์ที่จะพาไปเมื่อคลิก (optional)
 */
export const createNotification = async (userId, message, link = '/') => {
    try {
        await pool.query(
            'INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)',
            [userId, message, link]
        );
        console.log(`Notification created for user ${userId}: ${message}`);
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
};