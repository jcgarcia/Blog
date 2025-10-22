import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import path from 'path';

import CoreDB from './services/CoreDB.js';
import healthRoutes from './routes/health.js';
import connectionsRoutes from './routes/connections.js';
import authRoutes from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'https://blog.ingasti.com',
    credentials: true
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize CoreDB
let coreDB;

async function initializeDatabase() {
    try {
        console.log('🔧 CoreDB Service: Initializing database...');
        coreDB = CoreDB.getInstance();
        await coreDB.initialize();
        console.log('✅ CoreDB Service: Database initialized successfully');
    } catch (error) {
        console.error('❌ CoreDB Service: Database initialization failed:', error);
        process.exit(1);
    }
}

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Service error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal service error',
        message: err.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: [
            '/api/health',
            '/api/connections',
            '/api/auth/login'
        ]
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 CoreDB Service: Received SIGTERM, shutting down gracefully...');
    if (coreDB && coreDB.db) {
        await coreDB.db.close();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 CoreDB Service: Received SIGINT, shutting down gracefully...');
    if (coreDB && coreDB.db) {
        await coreDB.db.close();
    }
    process.exit(0);
});

// Start server
async function startServer() {
    await initializeDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 CoreDB Service: Running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
        console.log(`🔗 Connections API: http://localhost:${PORT}/api/connections`);
    });
}

startServer().catch(error => {
    console.error('❌ CoreDB Service: Failed to start:', error);
    process.exit(1);
});

export default app;