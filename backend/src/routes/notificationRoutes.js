// backend/src/routes/notificationRoutes.js
import express from 'express';
import { getMyNotifications, markAsRead } from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // ทุก route ในนี้ต้อง login

router.get('/', getMyNotifications);
router.put('/read/:id', markAsRead);

export default router;