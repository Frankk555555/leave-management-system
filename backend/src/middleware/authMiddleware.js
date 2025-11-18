import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            const [rows] = await pool.query('SELECT user_id, username, full_name, role, department_id FROM users WHERE user_id = ?', [decoded.id]);
            
            if (rows.length === 0) {
                return res.status(401).json({ message: 'User not found' });
            }
            
            req.user = rows[0]; 
            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const isHead = (req, res, next) => {
    if (req.user && req.user.role === 'head') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Department Head role required.' });
    }
};

export const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
};