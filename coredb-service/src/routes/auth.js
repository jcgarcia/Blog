import { Router } from 'express';
import jwt from 'jsonwebtoken';
import CoreDB from '../services/CoreDB.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';

/**
 * Admin login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        const coreDB = CoreDB.getInstance();
        const isValid = await coreDB.verifyAdmin(username, password);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                username,
                role: 'admin'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Login failed',
            details: error.message
        });
    }
});

/**
 * Verify token (for other services)
 */
router.post('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        res.json({
            success: true,
            valid: true,
            user: decoded
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            valid: false,
            error: 'Invalid token'
        });
    }
});

export default router;