import { Router } from 'express';
import CoreDB from '../services/CoreDB.js';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/', async (req, res) => {
    try {
        const coreDB = CoreDB.getInstance();
        const health = await coreDB.getHealthStatus();
        
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json({
            service: 'coredb-service',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            ...health
        });
    } catch (error) {
        res.status(503).json({
            service: 'coredb-service',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            status: 'unhealthy',
            error: error.message
        });
    }
});

export default router;