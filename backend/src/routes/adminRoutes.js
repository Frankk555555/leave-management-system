// backend/src/routes/adminRoutes.js
import express from 'express';
import { 
    getAllUsers, 
    createUser, 
    deleteUser, 
    getLeaveStats,
    resetUserPassword,
    getAllDepartments,
    getUserQuotas,
    upsertUserQuotas,
    getFullLeaveReport,
    getStatsByDepartment,
    getStatsMaxedQuota,


} from '../controllers/adminController.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- All routes in this file are for Admin and require login ---
router.use(protect, isAdmin);

// User Management
router.route('/users')
    .get(getAllUsers)
    .post(createUser);

router.route('/users/:id')
    .delete(deleteUser);

router.put('/users/:id/reset-password', resetUserPassword);

// Departments
router.get('/departments', getAllDepartments);

// Stats
router.get('/stats', getLeaveStats);
router.get('/stats/by-department', getStatsByDepartment); 
router.get('/stats/maxed-quota', getStatsMaxedQuota);

// --- Quota Management ---
router.get('/quotas/:userId/:year', getUserQuotas);
router.post('/quotas/batch', upsertUserQuotas);

// --- Reports ---
router.get('/reports/all-leave', getFullLeaveReport);

export default router;