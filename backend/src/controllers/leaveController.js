// backend/src/controllers/leaveController.js
import pool from '../config/db.js';
import multer from 'multer'; // (Import multer)
import path from 'path';
import { createNotification } from '../utils/notificationHelper.js';
import { getLeaveBalance, calculateLeaveDays, getAllLeaveBalances } from '../utils/leaveHelper.js';

// --- VVVV (START) นี่คือส่วนที่แก้ไข VVVV ---

// 1. Define storage (เหมือนเดิม)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'leave-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// 2. Define File Filter (ตัวกรองไฟล์)
const fileFilter = (req, file, cb) => {
    // กำหนดประเภทไฟล์ที่อนุญาต
    const allowedTypes = [
        'image/jpeg',  // .jpg, .jpeg
        'image/png',   // .png
        'application/pdf' // .pdf
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true); // (อนุญาตไฟล์นี้)
    } else {
        // (ไม่อนุญาตไฟล์นี้)
        cb(new Error('ประเภทไฟล์ไม่ได้รับอนุญาต (ต้องเป็น JPG, PNG, หรือ PDF เท่านั้น)'), false);
    }
};

// 3. Define Limits (จำกัดขนาด)
const limits = {
    fileSize: 1024 * 1024 * 5 // 5MB (5 เมกะไบต์)
};

// 4. Create multer instance
const multerUpload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: limits
});

// 5. สร้าง Middleware ที่ฉลาดขึ้น เพื่อดักจับ Error จาก Multer
export const upload = (req, res, next) => {
    // (เราจะรัน .single('attachment') จากตรงนี้แทน)
    const uploader = multerUpload.single('attachment');
    
    uploader(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Error จาก Multer (เช่น ไฟล์ใหญ่ไป)
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'ไฟล์มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 5MB)' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {
            // Error อื่นๆ (เช่น ผิดประเภทไฟล์ จาก fileFilter)
            return res.status(400).json({ message: err.message });
        }
        // ถ้าทุกอย่างผ่าน
        next();
    });
};
// --- ^^^^ (END) สิ้นสุดส่วนที่แก้ไข ^^^^ ---


// (ฟังก์ชันทั้งหมดด้านล่างนี้ 
// submitLeave, getMyLeaveRequests, getPendingForHead, approveLeave, 
// rejectLeave, getMyLeaveBalances, getCalendarEvents 
// ... ให้คงไว้เหมือนเดิม ไม่ต้องแก้ไข)

// @desc    Submit a leave request
export const submitLeave = async (req, res) => {
    // ... (โค้ด Logic การยื่นลา... ไม่ต้องแก้) ...
    const { leave_type, start_date, end_date, reason } = req.body;
    const user_id = req.user.user_id;
    const department_id = req.user.department_id;

    if (!department_id) {
        return res.status(400).json({ message: 'ผู้ใช้ไม่ได้สังกัดภาควิชา' });
    }
    const year = new Date(start_date).getFullYear();
    const requestedDays = calculateLeaveDays(start_date, end_date);
    if (requestedDays <= 0) {
        return res.status(400).json({ message: 'ช่วงวันที่ลาไม่ถูกต้อง' });
    }
    const balance = await getLeaveBalance(user_id, leave_type, year);
    if (balance.total === 0) {
        return res.status(400).json({ message: `ไม่พบโควต้าสำหรับ ${leave_type} ในปี ${year}` });
    }
    if (requestedDays > balance.remaining) {
        return res.status(400).json({ 
            message: `โควต้าการลาไม่เพียงพอ คุณขอลา ${requestedDays} วัน, แต่เหลือเพียง ${balance.remaining} วัน` 
        });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [headRows] = await connection.query(
            'SELECT user_id FROM users WHERE role = ? AND department_id = ?',
            ['head', department_id]
        );

        if (headRows.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'ไม่พบหัวหน้าภาควิชาสำหรับอนุมัติ' });
        }
        const approver_id = headRows[0].user_id;

        const [result] = await connection.query(
            'INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, approver_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user_id, leave_type, start_date, end_date, reason, approver_id, 'pending']
        );
        
        const newRequestId = result.insertId;

        // (สำคัญ) ถ้า req.file มีค่า (แปลว่าอัปโหลดผ่าน) ค่อยบันทึก
        if (req.file) {
            await connection.query(
                'INSERT INTO leave_attachments (request_id, file_path, original_filename) VALUES (?, ?, ?)',
                [newRequestId, req.file.path, req.file.originalname]
            );
        }

        await connection.commit();

        const applicantName = req.user.full_name;
        await createNotification(
            approver_id, 
            `มีใบลาใหม่จาก: ${applicantName}`, 
            '/dashboard/head'
        );

        res.status(201).json({ message: 'ยื่นใบลาสำเร็จ', requestId: newRequestId });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        connection.release();
    }
};

// (ฟังก์ชันอื่นๆ ที่เหลือ)
export const getMyLeaveRequests = async (req, res) => {
    // ... (เหมือนเดิม)
    try {
        const [requests] = await pool.query(
            `SELECT lr.*, a.file_path 
             FROM leave_requests lr
             LEFT JOIN leave_attachments a ON lr.request_id = a.request_id
             WHERE lr.user_id = ? 
             ORDER BY lr.created_at DESC`,
            [req.user.user_id]
        );
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
export const getPendingForHead = async (req, res) => {
    // ... (เหมือนเดิม)
    try {
        const [requests] = await pool.query(
            `SELECT lr.*, u.full_name AS applicant_name, a.file_path
             FROM leave_requests lr
             JOIN users u ON lr.user_id = u.user_id
             LEFT JOIN leave_attachments a ON lr.request_id = a.request_id
             WHERE lr.approver_id = ? AND lr.status = 'pending'
             ORDER BY lr.created_at ASC`,
            [req.user.user_id]
        );
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
export const approveLeave = async (req, res) => {
    // ... (เหมือนเดิม)
    const { remarks } = req.body;
    const requestId = req.params.id;
    try {
        const [rows] = await pool.query('SELECT user_id, leave_type FROM leave_requests WHERE request_id = ?', [requestId]);
        if (rows.length === 0) { return res.status(404).json({ message: 'ไม่พบใบลา' }); }
        const applicantUserId = rows[0].user_id;
        await pool.query(
            "UPDATE leave_requests SET status = 'approved', head_remarks = ? WHERE request_id = ? AND approver_id = ?",
            [remarks || null, requestId, req.user.user_id]
        );
        await createNotification(
            applicantUserId,
            `ใบลา (ID: ${requestId}) ได้รับการ "อนุมัติ" แล้ว`,
            '/dashboard/teacher'
        );
        res.json({ message: 'อนุมัติใบลาเรียบร้อย' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
export const rejectLeave = async (req, res) => {
    // ... (เหมือนเดิม)
    const { remarks } = req.body;
    const requestId = req.params.id;
    if (!remarks) { return res.status(400).json({ message: 'กรุณาระบุหมายเหตุประกอบการไม่อนุมัติ' }); }
    try {
        const [rows] = await pool.query('SELECT user_id, leave_type FROM leave_requests WHERE request_id = ?', [requestId]);
        if (rows.length === 0) { return res.status(404).json({ message: 'ไม่พบใบลา' }); }
        const applicantUserId = rows[0].user_id;
        await pool.query(
            "UPDATE leave_requests SET status = 'rejected', head_remarks = ? WHERE request_id = ? AND approver_id = ?",
            [remarks, requestId, req.user.user_id]
        );
        await createNotification(
            applicantUserId,
            `ใบลา (ID: ${requestId}) ถูก "ไม่อนุมัติ"`,
            '/dashboard/teacher'
        );
        res.json({ message: 'ไม่อนุมัติใบลาเรียบร้อย' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
export const getMyLeaveBalances = async (req, res) => {
    // ... (เหมือนเดิม)
    try {
        const year = new Date().getFullYear();
        const balances = await getAllLeaveBalances(req.user.user_id, year);
        res.json(balances);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
export const getCalendarEvents = async (req, res) => {
    // ... (เหมือนเดิม)
    const { user_id, role, department_id } = req.user;
    let query = `SELECT lr.request_id, lr.start_date, lr.end_date, u.full_name, lr.leave_type, lr.user_id 
                 FROM leave_requests lr JOIN users u ON lr.user_id = u.user_id WHERE lr.status = 'approved'`;
    const params = [];
    if (role === 'teacher') { query += ' AND lr.user_id = ?'; params.push(user_id); } 
    else if (role === 'head') { query += ' AND u.department_id = ?'; params.push(department_id); }
    try {
        const [rows] = await pool.query(query, params);
        const events = rows.map(row => {
            let leaveTypeThai;
            switch (row.leave_type) {
                case 'sick': leaveTypeThai = 'ลาป่วย'; break;
                case 'personal': leaveTypeThai = 'ลากิจ'; break;
                case 'vacation': leaveTypeThai = 'ลาพักผ่อน'; break;
                default: leaveTypeThai = 'ลา';
            }
            const title = (role === 'teacher' && row.user_id === user_id) ? leaveTypeThai : `${row.full_name} (${leaveTypeThai})`;
            const endDate = new Date(row.end_date);
            endDate.setDate(endDate.getDate() + 1);
            return { id: row.request_id, title: title, start: new Date(row.start_date), end: endDate, allDay: true };
        });
        res.json(events);
    } catch (error) {
        console.error('Get Calendar Events Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};