// backend/src/controllers/notificationController.js
import pool from '../config/db.js';

// @desc    Get all unread notifications for current user
// @route   GET /api/notifications
export const getMyNotifications = async (req, res) => {
    try {
        const [notifications] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC',
            [req.user.user_id]
        );
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/read/:id
export const markAsRead = async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
            [req.params.id, req.user.user_id]
        );
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};