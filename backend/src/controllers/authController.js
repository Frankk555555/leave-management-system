// backend/src/controllers/authController.js
import crypto from 'crypto';
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Function to generate JWT
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '1d',
    });
};

// @desc    Login user
// @route   POST /api/auth/login
export const loginUser = async (req, res) => {
    const { username, password } = req.body;

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [trimmedUsername]);

        if (rows.length === 0) {
            // --- 1. แปลข้อความ ---
            return res.status(401).json({ message: 'ชื่อผู้ใช้นี้ไม่มีในระบบ' });
        }

        const user = rows[0];
        const dbHash = user.password_hash.trim(); 
        const isMatch = await bcrypt.compare(trimmedPassword, dbHash);

        if (!isMatch) {
            // --- 2. แปลข้อความ ---
            return res.status(401).json({ message: 'รหัสผ่านไม่ถูกต้อง' });
        }

        const token = generateToken(user.user_id, user.role);

        res.json({
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                department_id: user.department_id
            }
        });

    } catch (error) {
        console.error('Login Error:', error); 
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์', error: error.message });
    }
};

// @desc    Get current user data
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
    res.json(req.user);
};

export const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.user_id; // (ได้จาก middleware 'protect')

    if (!oldPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    try {
        // 1. ดึงรหัส hash ปัจจุบันจาก DB
        const [rows] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
        }
        const dbHash = rows[0].password_hash;

        // 2. ตรวจสอบว่ารหัส "เก่า" ที่ป้อนมา ตรงกับใน DB หรือไม่
        const isMatch = await bcrypt.compare(oldPassword, dbHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง!' });
        }

        // 3. ถ้าตรงกัน ก็ hash รหัส "ใหม่"
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // 4. อัปเดตลง DB
        await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, userId]);

        res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });

    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// (ต่อท้ายไฟล์ backend/src/controllers/authController.js)

// @desc    Forgot password (Request reset link)
// @route   POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        // 1. หา User ด้วยอีเมล
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            // (เพื่อความปลอดภัย เราจะไม่บอกว่า "ไม่พบอีเมล")
            console.log(`DEBUG: Forgot password request for non-existent email: ${email}`);
            return res.json({ message: 'หากอีเมลนี้มีในระบบ ลิงก์รีเซ็ตรหัสผ่านจะถูกส่งไป (ดูที่ Console ของ Backend)' });
        }
        const user = rows[0];

        // 2. สร้าง Token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // 3. Hash Token ก่อนเก็บลง DB (เพื่อความปลอดภัย)
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // 4. ตั้งเวลาหมดอายุ (10 นาที)
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // 5. บันทึก Token (Hashed) และวันหมดอายุลง DB
        await pool.query(
            'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE user_id = ?',
            [hashedToken, expires, user.user_id]
        );

        // 6. สร้างลิงก์ (ที่จะส่งให้ User)
        // (เราส่ง Token ที่ยังไม่ HASH ไปในลิงก์)
        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

        // 7. !!! (สำคัญ) จำลองการส่งอีเมล !!!
        // (ในระบบจริง เราจะส่ง 'resetUrl' ทางอีเมล)
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.log('!!! อีเมลลืมรหัสผ่าน (จำลอง) !!!');
        console.log(`!!! ส่งถึง: ${email}`);
        console.log('!!! คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:');
        console.log(resetUrl);
        console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

        res.json({ message: 'หากอีเมลนี้มีในระบบ ลิงก์รีเซ็ตรหัสผ่านจะถูกส่งไป (ดูที่ Console ของ Backend)' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reset password (using token)
// @route   POST /api/auth/reset-password/:token
export const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    try {
        // 1. Hash Token ที่ได้จาก URL เพื่อไปเทียบกับใน DB
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // 2. ค้นหา User ด้วย Hashed Token และยังไม่หมดอายุ
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
            [hashedToken]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Token ไม่ถูกต้อง หรือ หมดอายุแล้ว' });
        }
        const user = rows[0];

        // 3. Hash รหัสผ่านใหม่
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // 4. อัปเดตรหัสผ่านใหม่ และล้าง Token ทิ้ง
        await pool.query(
            'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE user_id = ?',
            [newHash, user.user_id]
        );

        res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ! คุณสามารถใช้รหัสใหม่นี้เข้าสู่ระบบได้เลย' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};