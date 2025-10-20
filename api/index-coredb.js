import express from "express";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import publishRoutes from "./routes/publish.js";
import settingsRoutes from "./routes/settings.js";
import contactRoutes from "./routes/contact.js";
import categoriesRoutes from "./routes/categories.js";
import staticPagesRoutes from "./routes/staticPages.js";
import mediaRoutes from "./routes/media.js";
import databaseRoutes from "./routes/database.js";
import likesRoutes from "./routes/likes.js";
import socialFeaturesRoutes from "./routes/socialFeatures.js";
import testCommentsRoutes from "./routes/testComments.js";
import viewsRoutes from "./routes/views.js";
import analyticsRoutes from "./routes/analytics.js";
import awsRoutes from "./routes/aws.js";
import metaRoutes from "./routes/meta.js";
import cookieParser from "cookie-parser";
import multer from "multer";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import fs from "fs";
import dotenv from "dotenv";
import CoreDB from "./services/CoreDB.js";
import { Pool } from "pg";

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();

// Initialize CoreDB
const coreDB = new CoreDB();
let externalDbPool = null;

/**
 * Initialize external database connection using CoreDB configuration
 */
async function initializeExternalDatabase() {
    try {
        const dbConfig = await coreDB.getActiveDatabase();
        
        if (dbConfig) {
            const connectionString = `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database_name}?sslmode=${dbConfig.ssl_mode}`;
            
            externalDbPool = new Pool({
                connectionString,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
            
            // Test connection
            const client = await externalDbPool.connect();
            await client.query('SELECT NOW()');
            client.release();
            
            console.log(`✅ External database connected: ${dbConfig.host}/${dbConfig.database_name}`);
            
            // Initialize migrations if external database is available
            try {
                const { initializeDatabaseMigrations } = await import("./migrations.js");
                await initializeDatabaseMigrations(externalDbPool);
                console.log('✅ Database migrations completed');
            } catch (migrationError) {
                console.log('⚠️  Database migrations failed:', migrationError.message);
            }
            
        } else {
            console.log('ℹ️  No external database configured - running with CoreDB only');
        }
        
    } catch (error) {
        console.log('⚠️  External database connection failed:', error.message);
        console.log('ℹ️  Blog will continue with CoreDB only');
    }
}

/**
 * Get database pool (external or null)
 */
function getDbPool() {
    return externalDbPool;
}

/**
 * Application startup
 */
async function startApplication() {
    try {
        // 1. Initialize CoreDB first (always required)
        console.log('🔧 Initializing CoreDB...');
        await coreDB.initialize();
        console.log('✅ CoreDB ready - blog can start');
        
        // Make CoreDB available to all routes
        app.locals.coreDB = coreDB;
        app.locals.getDbPool = getDbPool;
        
        // 2. Try to initialize external database (optional)
        await initializeExternalDatabase();
        
        // 3. Set up CORS with configuration from CoreDB
        const corsOrigin = await coreDB.getConfig('cors_origin') || 'http://localhost:3000';
        const allowedOrigins = [
            corsOrigin,
            "https://bedtime.ingasti.com",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173"  // Vite dev server
        ];
        
        app.use((req, res, next) => {
            const origin = req.headers.origin;
            if (allowedOrigins.includes(origin)) {
                res.header("Access-Control-Allow-Origin", origin);
            }
            
            res.header("Access-Control-Allow-Credentials", "true");
            res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key");
            
            if (req.method === "OPTIONS") {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // 4. Setup express middleware
        app.use(express.json());
        app.use(cookieParser());
        
        // 5. Load system configuration middleware (simplified)
        app.use(async (req, res, next) => {
            try {
                // Load configuration from CoreDB
                const config = await coreDB.getAllConfig();
                const configObject = {};
                config.forEach(item => {
                    configObject[item.key] = item.value;
                });
                
                req.systemConfig = configObject;
                next();
            } catch (error) {
                console.error('Error loading system config:', error);
                req.systemConfig = {}; // Fallback to empty config
                next();
            }
        });
        
        // 6. Serve uploaded files statically
        app.use("/uploads", express.static("uploads"));
        
        // 7. Setup multer for file uploads
        const storage = multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, "./uploads");
            },
            filename: function (req, file, cb) {
                const timestamp = Date.now();
                const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
                cb(null, `${timestamp}-${originalName}`);
            }
        });
        
        const upload = multer({ 
            storage: storage,
            limits: {
                fileSize: parseInt(await coreDB.getConfig('max_file_size') || '10485760') // 10MB default
            }
        });
        
        // 8. Health check endpoint
        app.get('/health', async (req, res) => {
            const status = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                coredb: coreDB.initialized ? 'connected' : 'disconnected',
                external_db: externalDbPool ? 'connected' : 'disconnected'
            };
            
            res.json(status);
        });
        
        // 9. CoreDB admin authentication endpoint
        app.post('/api/admin/coredb-login', async (req, res) => {
            try {
                const { username, password } = req.body;
                
                if (!username || !password) {
                    return res.status(400).json({ error: 'Username and password required' });
                }
                
                const user = await coreDB.authenticateAdmin(username, password);
                
                if (user) {
                    // Create session or JWT token here
                    res.json({ 
                        success: true, 
                        user: {
                            id: user.id,
                            username: user.username,
                            role: user.role
                        },
                        message: 'Authentication successful'
                    });
                } else {
                    res.status(401).json({ error: 'Invalid credentials' });
                }
                
            } catch (error) {
                console.error('CoreDB login error:', error);
                res.status(500).json({ error: 'Authentication failed' });
            }
        });
        
        // 10. CoreDB configuration endpoints
        app.get('/api/admin/coredb/config', async (req, res) => {
            try {
                // TODO: Add authentication middleware
                const config = await coreDB.getAllConfig();
                res.json(config);
            } catch (error) {
                console.error('Error getting CoreDB config:', error);
                res.status(500).json({ error: 'Failed to get configuration' });
            }
        });
        
        app.get('/api/admin/coredb/stats', async (req, res) => {
            try {
                // TODO: Add authentication middleware
                const stats = await coreDB.getStats();
                res.json(stats);
            } catch (error) {
                console.error('Error getting CoreDB stats:', error);
                res.status(500).json({ error: 'Failed to get statistics' });
            }
        });
        
        // 11. Setup routes
        app.use("/api/auth", authRoutes);
        app.use("/api/admin", adminRoutes);
        app.use("/api/users", userRoutes);
        app.use("/api/posts", postRoutes);
        app.use("/api/publish", publishRoutes);
        app.use("/api/settings", settingsRoutes);
        app.use("/api/contact", contactRoutes);
        app.use("/api/categories", categoriesRoutes);
        app.use("/api/static-pages", staticPagesRoutes);
        app.use("/api/media", mediaRoutes);
        app.use("/api/database", databaseRoutes);
        app.use("/api/likes", likesRoutes);
        app.use("/api/social-features", socialFeaturesRoutes);
        app.use("/api/test-comments", testCommentsRoutes);
        app.use("/api/views", viewsRoutes);
        app.use("/api/analytics", analyticsRoutes);
        app.use("/api/aws", awsRoutes);
        app.use("/api/meta", metaRoutes);
        
        // 12. Error handling middleware
        app.use((error, req, res, next) => {
            console.error('Application error:', error);
            res.status(500).json({ 
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        });
        
        // 13. Start server
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`🚀 Blog server running on port ${PORT}`);
            console.log(`✅ CoreDB: ${coreDB.initialized ? 'Ready' : 'Error'}`);
            console.log(`✅ External DB: ${externalDbPool ? 'Connected' : 'Not configured'}`);
            console.log(`🌐 CORS origin: ${corsOrigin}`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start application:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Shutting down gracefully...');
    
    if (externalDbPool) {
        await externalDbPool.end();
        console.log('✅ External database pool closed');
    }
    
    if (coreDB) {
        await coreDB.close();
        console.log('✅ CoreDB closed');
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Shutting down gracefully...');
    
    if (externalDbPool) {
        await externalDbPool.end();
        console.log('✅ External database pool closed');
    }
    
    if (coreDB) {
        await coreDB.close();
        console.log('✅ CoreDB closed');
    }
    
    process.exit(0);
});

// Start the application
startApplication();