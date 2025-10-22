import { Router } from 'express';
import CoreDB from '../services/CoreDB.js';

const router = Router();

/**
 * Get all database connections
 */
router.get('/', async (req, res) => {
    try {
        const coreDB = CoreDB.getInstance();
        const connections = await coreDB.getDatabaseConnections();
        
        res.json({
            success: true,
            connections: connections.map(conn => ({
                ...conn,
                password: '***masked***' // Never expose passwords in API responses
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch connections',
            details: error.message
        });
    }
});

/**
 * Get active database connection
 */
router.get('/active', async (req, res) => {
    try {
        const coreDB = CoreDB.getInstance();
        const connection = await coreDB.getActiveDatabaseConnection();
        
        if (!connection) {
            return res.json({
                success: true,
                connection: null,
                message: 'No active database connection'
            });
        }

        res.json({
            success: true,
            connection: {
                ...connection,
                password: '***masked***' // Never expose passwords
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active connection',
            details: error.message
        });
    }
});

/**
 * Get full connection details (including password) - for backend use only
 */
router.get('/active/full', async (req, res) => {
    try {
        const coreDB = CoreDB.getInstance();
        const connection = await coreDB.getActiveDatabaseConnection();
        
        if (!connection) {
            return res.json({
                success: true,
                connection: null,
                message: 'No active database connection'
            });
        }

        // Return full connection details including password for backend use
        res.json({
            success: true,
            connection: connection
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch full connection details',
            details: error.message
        });
    }
});

/**
 * Create new database connection
 */
router.post('/', async (req, res) => {
    try {
        const { name, type, host, port, database_name, username, password, is_active } = req.body;
        
        if (!name || !host || !database_name || !username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                required: ['name', 'host', 'database_name', 'username', 'password']
            });
        }

        const coreDB = CoreDB.getInstance();
        const connectionId = await coreDB.createDatabaseConnection({
            name,
            type: type || 'postgresql',
            host,
            port: port || 5432,
            database_name,
            username,
            password,
            is_active: is_active || false
        });

        res.status(201).json({
            success: true,
            message: 'Database connection created successfully',
            connection_id: connectionId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create connection',
            details: error.message
        });
    }
});

/**
 * Update database connection
 */
router.put('/:id', async (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);
        const updates = req.body;

        if (isNaN(connectionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid connection ID'
            });
        }

        const coreDB = CoreDB.getInstance();
        await coreDB.updateDatabaseConnection(connectionId, updates);

        res.json({
            success: true,
            message: 'Database connection updated successfully'
        });
    } catch (error) {
        const status = error.message === 'Connection not found' ? 404 : 500;
        res.status(status).json({
            success: false,
            error: 'Failed to update connection',
            details: error.message
        });
    }
});

/**
 * Delete database connection
 */
router.delete('/:id', async (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);

        if (isNaN(connectionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid connection ID'
            });
        }

        const coreDB = CoreDB.getInstance();
        await coreDB.deleteDatabaseConnection(connectionId);

        res.json({
            success: true,
            message: 'Database connection deleted successfully'
        });
    } catch (error) {
        const status = error.message === 'Connection not found' ? 404 : 500;
        res.status(status).json({
            success: false,
            error: 'Failed to delete connection',
            details: error.message
        });
    }
});

/**
 * Set active database connection
 */
router.post('/:id/activate', async (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);

        if (isNaN(connectionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid connection ID'
            });
        }

        const coreDB = CoreDB.getInstance();
        await coreDB.setActiveDatabaseConnection(connectionId);

        res.json({
            success: true,
            message: 'Database connection activated successfully'
        });
    } catch (error) {
        const status = error.message === 'Connection not found' ? 404 : 500;
        res.status(status).json({
            success: false,
            error: 'Failed to activate connection',
            details: error.message
        });
    }
});

/**
 * Emergency: Clear all connections
 */
router.post('/emergency/clear', async (req, res) => {
    try {
        const coreDB = CoreDB.getInstance();
        const clearedCount = await coreDB.clearAllConnections();

        res.json({
            success: true,
            message: `Emergency: Cleared ${clearedCount} database connections`,
            cleared_count: clearedCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to clear connections',
            details: error.message
        });
    }
});

export default router;