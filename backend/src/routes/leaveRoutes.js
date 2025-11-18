// backend/src/routes/leaveRoutes.js
import express from 'express';
import { 
    submitLeave, 
    getMyLeaveRequests, 
    getPendingForHead, 
    approveLeave, 
    rejectLeave,
    upload, // (นี่คือ import)
    getMyLeaveBalances,
    getCalendarEvents
} from '../controllers/leaveController.js';
import { protect, isHead } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- Teacher Routes ---

// --- VVVV (START) นี่คือส่วนที่แก้ไข VVVV ---
// (เราเอา .single('attachment') ออก เพราะเราย้าย Logic ไปไว้ในตัว 'upload' แล้ว)
router.post('/submit', protect, upload, submitLeave);
// --- ^^^^ (END) สิ้นสุดส่วนที่แก้ไข ^^^^ ---

router.get('/my-history', protect, getMyLeaveRequests);
router.get('/my-balance', protect, getMyLeaveBalances);

// --- Head Routes ---
router.get('/head/pending', protect, isHead, getPendingForHead);
router.put('/head/approve/:id', protect, isHead, approveLeave);
router.put('/head/reject/:id', protect, isHead, rejectLeave);

// --- Calendar Route ---
router.get('/calendar-events', protect, getCalendarEvents);

export default router;