// backend/src/controllers/leaveController.js
import pool from '../config/db.js';
import multer from 'multer';
import path from 'path';
// เปลี่ยนไปใช้ Telegram Notify Helper
import { sendTelegramNotify } from '../utils/telegramNotifyHelper.js';
import { getLeaveBalance, calculateLeaveDays, getAllLeaveBalances } from '../utils/leaveHelper.js';

// --- VVVV Multer Config (File Validation) VVVV ---

// 1. Define storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'leave-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// 2. Define File Filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',  // .jpg, .jpeg
        'image/png',   // .png
        'application/pdf' // .pdf
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('ประเภทไฟล์ไม่ได้รับอนุญาต (ต้องเป็น JPG, PNG, หรือ PDF เท่านั้น)'), false);
    }
};

// 3. Define Limits
const limits = {
    fileSize: 1024 * 1024 * 5 // 5MB
};

// 4. Create multer instance
const multerUpload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: limits
});

// 5. Middleware wrapper
export const upload = (req, res, next) => {
    const uploader = multerUpload.single('attachment');
    
    uploader(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'ไฟล์มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 5MB)' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    });
};
// --- ^^^^ End Multer Config ^^^^ ---


// @desc    Submit a leave request
// @route   POST /api/leave/submit
export const submitLeave = async (req, res) => {
    const { leave_type, start_date, end_date, reason, duration } = req.body;
    const user_id = req.user.user_id;
    const department_id = req.user.department_id;

    if (!department_id) {
        return res.status(400).json({ message: 'ผู้ใช้ไม่ได้สังกัดภาควิชา' });
    }

    // Validation สำหรับครึ่งวัน
    if (duration !== 'full' && start_date !== end_date) {
        return res.status(400).json({ message: 'การลาครึ่งวันต้องเริ่มต้นและสิ้นสุดในวันเดียวกัน' });
    }

    // --- 1. ตรวจสอบโควต้า ---
    const year = new Date(start_date).getFullYear();
    // คำนวณวันลาโดยคิด duration ด้วย
    const requestedDays = calculateLeaveDays(start_date, end_date, duration);
    
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
    // --- สิ้นสุดการตรวจสอบโควต้า ---

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

        // Insert ใบลาพร้อม duration
        const [result] = await connection.query(
            'INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, duration, approver_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id, leave_type, start_date, end_date, reason, duration || 'full', approver_id, 'pending']
        );
        
        const newRequestId = result.insertId;

        if (req.file) {
            await connection.query(
                'INSERT INTO leave_attachments (request_id, file_path, original_filename) VALUES (?, ?, ?)',
                [newRequestId, req.file.path, req.file.originalname]
            );
        }

        await connection.commit();

        // --- ส่ง Telegram Notify (ภาษาไทย) ---
        
        // 1. แปลประเภทการลาเป็นไทย
        let leaveTypeThai = leave_type;
        switch (leave_type) {
            case 'sick': leaveTypeThai = 'ลาป่วย'; break;
            case 'personal': leaveTypeThai = 'ลากิจ'; break;
            case 'vacation': leaveTypeThai = 'ลาพักผ่อน'; break;
            default: leaveTypeThai = leave_type;
        }

        // 2. แปลช่วงเวลา
        let durationThai = 'เต็มวัน';
        if (duration === 'morning') durationThai = 'ครึ่งวัน (เช้า)';
        if (duration === 'afternoon') durationThai = 'ครึ่งวัน (บ่าย)';

        // 3. แปลงวันที่ให้สวยงาม (Option: เปลี่ยน ค.ศ. เป็น พ.ศ. และกลับด้าน)
        // (ถ้า start_date มาเป็น '2025-11-27' เราจะแปลงเป็น '27/11/2568')
        const formatDateThai = (dateString) => {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            });
        };

        const startDateThai = formatDateThai(start_date);
        const endDateThai = formatDateThai(end_date);
        const applicantName = req.user.full_name;

        const attachmentStatus = req.file ? 'มีไฟล์แนบ' : 'ไม่มี';
        // 4. สร้างข้อความตามรูปแบบที่คุณต้องการ
        const message = `
📢 <b>มีการลาใหม่!</b> (${durationThai})
👤 <b>ชื่อ:</b> ${applicantName}
📝 <b>ประเภท:</b> ${leaveTypeThai}
📅 <b>วันที่:</b> ${startDateThai} ถึง ${endDateThai}
💬 <b>เหตุผล:</b> ${reason}
📂 <b>เอกสารรับรอง:</b> ${attachmentStatus}
        `.trim();
        
        // ส่ง Telegram (พร้อมไฟล์แนบ ถ้ามี)
        const attachmentPath = req.file ? req.file.path : null;
        await sendTelegramNotify(message, attachmentPath);
        // ---------------------------------------------------

        res.status(201).json({ message: 'ยื่นใบลาสำเร็จ', requestId: newRequestId });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        connection.release();
    }
};

// @desc    Get user's own leave history
// @route   GET /api/leave/my-history
export const getMyLeaveRequests = async (req, res) => {
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

// @desc    Get pending requests for Head
// @route   GET /api/leave/head/pending
export const getPendingForHead = async (req, res) => {
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

// @desc    Approve a leave request
// @route   PUT /api/leave/head/approve/:id
// @desc    Approve a leave request
// @route   PUT /api/leave/head/approve/:id
export const approveLeave = async (req, res) => {
    const { remarks } = req.body;
    const requestId = req.params.id;
    
    try {
        // 1. ดึงข้อมูลใบลา และ ชื่อผู้ลา (JOIN users)
        const [rows] = await pool.query(
            `SELECT lr.*, u.full_name 
             FROM leave_requests lr
             JOIN users u ON lr.user_id = u.user_id
             WHERE lr.request_id = ?`, 
            [requestId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบใบลา' });
        }

        const leaveReq = rows[0]; // ข้อมูลใบลา

        // 2. อัปเดตสถานะเป็น Approved
        await pool.query(
            "UPDATE leave_requests SET status = 'approved', head_remarks = ? WHERE request_id = ? AND approver_id = ?",
            [remarks || null, requestId, req.user.user_id]
        );

        // --- 3. เตรียมข้อมูลสำหรับแจ้งเตือน (จัดรูปแบบ) ---
        
        // แปลวันที่
        const formatDateThai = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('th-TH', {
                year: 'numeric', month: '2-digit', day: '2-digit',
            });
        };

        // แปลประเภทการลา
        let leaveTypeThai = leaveReq.leave_type;
        switch (leaveReq.leave_type) {
            case 'sick': leaveTypeThai = 'ลาป่วย'; break;
            case 'personal': leaveTypeThai = 'ลากิจ'; break;
            case 'vacation': leaveTypeThai = 'ลาพักผ่อน'; break;
        }

        // แปลช่วงเวลา
        let durationThai = 'เต็มวัน';
        if (leaveReq.duration === 'morning') durationThai = 'ครึ่งวัน (เช้า)';
        if (leaveReq.duration === 'afternoon') durationThai = 'ครึ่งวัน (บ่าย)';

        // สร้างข้อความ
        const message = `
✅ <b>อนุมัติใบลาเรียบร้อย</b>
👤 <b>ของ:</b> ${leaveReq.full_name}
📝 <b>ประเภท:</b> ${leaveTypeThai} (${durationThai})
📅 <b>วันที่:</b> ${formatDateThai(leaveReq.start_date)} ถึง ${formatDateThai(leaveReq.end_date)}
💬 <b>เหตุผล:</b> ${leaveReq.reason}
📝 <b>หมายเหตุหัวหน้า:</b> ${remarks || '-'}
        `.trim();

        // ส่ง Telegram
        await sendTelegramNotify(message);
        // ----------------------------------------------

        res.json({ message: 'อนุมัติใบลาเรียบร้อย' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Reject a leave request
// @route   PUT /api/leave/head/reject/:id
// @desc    Reject a leave request
// @route   PUT /api/leave/head/reject/:id
export const rejectLeave = async (req, res) => {
    const { remarks } = req.body;
    const requestId = req.params.id;

    if (!remarks) {
        return res.status(400).json({ message: 'กรุณาระบุหมายเหตุประกอบการไม่อนุมัติ' });
    }
    
    try {
        // 1. ดึงข้อมูลใบลา และ ชื่อผู้ลา (JOIN users) เพื่อนำมาแจ้งเตือน
        const [rows] = await pool.query(
            `SELECT lr.*, u.full_name 
             FROM leave_requests lr
             JOIN users u ON lr.user_id = u.user_id
             WHERE lr.request_id = ?`, 
            [requestId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบใบลา' });
        }

        const leaveReq = rows[0];

        // 2. อัปเดตสถานะเป็น Rejected
        await pool.query(
            "UPDATE leave_requests SET status = 'rejected', head_remarks = ? WHERE request_id = ? AND approver_id = ?",
            [remarks, requestId, req.user.user_id]
        );

        // --- 3. เตรียมข้อมูลสำหรับแจ้งเตือน ---
        
        // แปลวันที่
        const formatDateThai = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('th-TH', {
                year: 'numeric', month: '2-digit', day: '2-digit',
            });
        };

        // แปลประเภทการลา
        let leaveTypeThai = leaveReq.leave_type;
        switch (leaveReq.leave_type) {
            case 'sick': leaveTypeThai = 'ลาป่วย'; break;
            case 'personal': leaveTypeThai = 'ลากิจ'; break;
            case 'vacation': leaveTypeThai = 'ลาพักผ่อน'; break;
        }

        // แปลช่วงเวลา
        let durationThai = 'เต็มวัน';
        if (leaveReq.duration === 'morning') durationThai = 'ครึ่งวัน (เช้า)';
        if (leaveReq.duration === 'afternoon') durationThai = 'ครึ่งวัน (บ่าย)';

        // สร้างข้อความแจ้งเตือน (เน้นสีแดงที่หัวข้อ)
        const message = `
❌ <b>ไม่อนุมัติใบลา</b>
👤 <b>ของ:</b> ${leaveReq.full_name}
📝 <b>ประเภท:</b> ${leaveTypeThai} (${durationThai})
📅 <b>วันที่:</b> ${formatDateThai(leaveReq.start_date)} ถึง ${formatDateThai(leaveReq.end_date)}
💬 <b>เหตุผลการลา:</b> ${leaveReq.reason}
⚠️ <b>เหตุผลที่ไม่อนุมัติ:</b> ${remarks}
        `.trim();

        // ส่ง Telegram
        await sendTelegramNotify(message);
        // --------------------------------

        res.json({ message: 'ไม่อนุมัติใบลาเรียบร้อย' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get user's all leave balances
// @route   GET /api/leave/my-balance
export const getMyLeaveBalances = async (req, res) => {
    try {
        const year = new Date().getFullYear();
        const balances = await getAllLeaveBalances(req.user.user_id, year);
        res.json(balances);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all "approved" leave events for the calendar
// @route   GET /api/leave/calendar-events
export const getCalendarEvents = async (req, res) => {
    const { user_id, role, department_id } = req.user;
    let query = `
        SELECT 
            lr.request_id, 
            lr.start_date, 
            lr.end_date, 
            u.full_name,
            lr.leave_type,
            lr.user_id 
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.user_id
        WHERE lr.status = 'approved' 
    `;

    const params = [];

    if (role === 'teacher') {
        query += ' AND lr.user_id = ?';
        params.push(user_id);
    } else if (role === 'head') {
        query += ' AND u.department_id = ?';
        params.push(department_id);
    }

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

            const title = (role === 'teacher' && row.user_id === user_id) 
                ? leaveTypeThai 
                : `${row.full_name} (${leaveTypeThai})`;

            const endDate = new Date(row.end_date);
            endDate.setDate(endDate.getDate() + 1);

            return {
                id: row.request_id,
                title: title,
                start: new Date(row.start_date),
                end: endDate,
                allDay: true
            };
        });

        res.json(events);

    } catch (error) {
        console.error('Get Calendar Events Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};