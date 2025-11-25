// backend/src/controllers/adminController.js
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import { getLeaveBalance } from '../utils/leaveHelper.js';

// @desc    Get all users (ไม่ต้องแปล เพราะเป็น data)
export const getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.user_id, u.username, u.full_name, u.email, u.role, d.department_name 
             FROM users u
             LEFT JOIN departments d ON u.department_id = d.department_id
             ORDER BY u.full_name`
        );
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Create a new user
// @route   POST /api/admin/users
export const createUser = async (req, res) => {
    const { username, password, full_name, email, role, department_id } = req.body;

    if (!username || !password || !full_name || !email || !role) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ' });
    }
    
    try {
        const [userExists] = await pool.query('SELECT user_id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (userExists.length > 0) {
            return res.status(400).json({ message: 'ชื่อผู้ใช้ (Username) หรืออีเมลนี้ ถูกใช้ไปแล้ว' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        await pool.query(
            'INSERT INTO users (username, password_hash, full_name, email, role, department_id) VALUES (?, ?, ?, ?, ?, ?)',
            [username, password_hash, full_name, email, role, department_id || null]
        );

        res.status(201).json({ message: 'สร้างผู้ใช้สำเร็จ' });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
export const deleteUser = async (req, res) => {
    const userId = req.params.id;
    try {
        await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);
        res.json({ message: 'ลบผู้ใช้สำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถลบผู้ใช้ได้ (อาจมีข้อมูลการลาค้างอยู่)', error: error.message });
    }
};

// @desc    Get leave statistics (ไม่ต้องแปล)
export const getLeaveStats = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT leave_type, COUNT(*) as count FROM leave_requests GROUP BY leave_type`
        );
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all departments (ไม่ต้องแปล)
export const getAllDepartments = async (req, res) => {
    try {
        const [departments] = await pool.query("SELECT * FROM departments ORDER BY department_name");
        res.json(departments);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Reset a user's password
// @route   PUT /api/admin/users/:id/reset-password
export const resetUserPassword = async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim().length < 6) {
        return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword.trim(), salt);

        const [result] = await pool.query(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [password_hash, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'ไม่พบผู้ใช้นี้' });
        }

        res.json({ message: 'รีเซ็ตรหัสผ่านสำเร็จ' });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get quotas for a specific user and year (ไม่ต้องแปล)
export const getUserQuotas = async (req, res) => {
    const { userId, year } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT leave_type, total_days FROM leave_quotas WHERE user_id = ? AND year = ?',
            [userId, year]
        );
        const quotas = { sick: 0, personal: 0, vacation: 0 };
        rows.forEach(row => {
            if (quotas.hasOwnProperty(row.leave_type)) {
                quotas[row.leave_type] = row.total_days;
            }
        });
        res.json(quotas);
    } catch (error) {
        console.error('Get User Quotas Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create or Update (Upsert) quotas for a user in batch
// @route   POST /api/admin/quotas/batch
export const upsertUserQuotas = async (req, res) => {
    const { userId, year, quotas } = req.body; 

    if (!userId || !year || !quotas) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const types = ['sick', 'personal', 'vacation'];
        
        for (const type of types) {
            const totalDays = quotas[type] || 0; 
            await connection.query(
                `INSERT INTO leave_quotas (user_id, leave_type, total_days, year) 
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE total_days = ?`,
                [userId, type, totalDays, year, totalDays]
            );
        }

        await connection.commit();
        res.json({ message: 'บันทึกโควต้าสำเร็จ' });

    } catch (error) {
        await connection.rollback();
        console.error('Upsert Quotas Error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
};

export const getFullLeaveReport = async (req, res) => {
    try {
        // (นี่คือ Query ที่ดึงข้อมูลจาก 3 ตาราง)
        const [reportData] = await pool.query(
            `SELECT 
                lr.request_id,
                u.full_name,
                d.department_name,
                lr.leave_type,
                lr.start_date,
                lr.end_date,
                lr.reason,
                lr.status,
                lr.head_remarks,
                lr.duration,
                lr.created_at AS submitted_at
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.user_id
            LEFT JOIN departments d ON u.department_id = d.department_id
            ORDER BY lr.created_at DESC`
        );
        res.json(reportData);
    } catch (error) {
        console.error('Get Full Report Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getStatsByDepartment = async (req, res) => {
    try {
        // นับจำนวนใบลา (ที่อนุมัติแล้ว) โดยจัดกลุ่มตามชื่อภาควิชา
        const [data] = await pool.query(
            `SELECT 
                d.department_name, 
                COUNT(lr.request_id) as leave_count
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.user_id
            JOIN departments d ON u.department_id = d.department_id
            WHERE lr.status = 'approved'
            GROUP BY d.department_name
            ORDER BY leave_count DESC`
        );
        res.json(data);
    } catch (error) {
        console.error('Get Stats by Dept Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getStatsMaxedQuota = async (req, res) => {
    try {
        const year = new Date().getFullYear();

        // 1. ดึงผู้ใช้ทั้งหมดที่เป็น teacher หรือ head
        const [users] = await pool.query(
            "SELECT user_id, full_name FROM users WHERE role IN ('teacher', 'head')"
        );

        const maxedUsers = [];

        // 2. (ข้อควรระวัง: นี่อาจจะช้าถ้ามี User หลายพันคน)
        // เราจะวนลูปเช็กโควต้าทีละคน
        await Promise.all(users.map(async (user) => {
            const balance = await getLeaveBalance(user.user_id, 'vacation', year);

            // ถ้าโควต้า "คงเหลือ" เป็น 0 หรือติดลบ
            if (balance.total > 0 && balance.remaining <= 0) {
                maxedUsers.push(user.full_name);
            }
        }));

        res.json(maxedUsers); // (ส่งกลับเป็น Array ของชื่อ)

    } catch (error) {
        console.error('Get Maxed Quota Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

