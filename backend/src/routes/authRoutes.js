import express from 'express';
import { loginUser, getMe, changePassword,forgotPassword,resetPassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', loginUser);
// เราจะให้ Admin สร้าง User ผ่าน /api/admin/users แทนการ register ทั่วไป
// router.post('/register', registerUser); 
router.get('/me', protect, getMe);

// (ใช้ POST หรือ PUT ก็ได้)
router.post('/change-password', protect, changePassword);

//
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

export default router;