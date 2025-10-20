import express from 'express';
import CoreDB from './services/CoreDB.js';

const app = express();
const coreDB = new CoreDB();

// Middleware
app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    
    if (req.method === "OPTIONS") {
        res.sendStatus(200);
    } else {
        next();
    }
});

async function startServer() {
    try {
        // Initialize CoreDB
        console.log('🔧 Initializing CoreDB...');
        await coreDB.initialize();
        
        // Health check
        app.get('/health', async (req, res) => {
            const stats = await coreDB.getStats();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                coredb: {
                    initialized: coreDB.initialized,
                    stats: stats
                }
            });
        });
        
        // CoreDB admin login
        app.post('/api/admin/login', async (req, res) => {
            try {
                const { username, password } = req.body;
                
                if (!username || !password) {
                    return res.status(400).json({ error: 'Username and password required' });
                }
                
                const user = await coreDB.authenticateAdmin(username, password);
                
                if (user) {
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
                console.error('Login error:', error);
                res.status(500).json({ error: 'Authentication failed' });
            }
        });
        
        // Get configuration
        app.get('/api/config', async (req, res) => {
            try {
                const config = await coreDB.getAllConfig();
                res.json(config);
            } catch (error) {
                console.error('Config error:', error);
                res.status(500).json({ error: 'Failed to get configuration' });
            }
        });
        
        // Get external database config
        app.get('/api/database/config', async (req, res) => {
            try {
                const dbConfig = await coreDB.getActiveDatabase();
                if (dbConfig) {
                    // Remove sensitive data
                    const { password, ...safeConfig } = dbConfig;
                    res.json(safeConfig);
                } else {
                    res.json({ message: 'No external database configured' });
                }
            } catch (error) {
                console.error('Database config error:', error);
                res.status(500).json({ error: 'Failed to get database configuration' });
            }
        });
        
        // Get storage provider config
        app.get('/api/storage/config', async (req, res) => {
            try {
                const storageConfig = await coreDB.getActiveStorageProvider();
                if (storageConfig) {
                    res.json(storageConfig);
                } else {
                    res.json({ message: 'No storage provider configured' });
                }
            } catch (error) {
                console.error('Storage config error:', error);
                res.status(500).json({ error: 'Failed to get storage configuration' });
            }
        });
        
        // CoreDB stats
        app.get('/api/coredb/stats', async (req, res) => {
            try {
                const stats = await coreDB.getStats();
                const config = await coreDB.getAllConfig();
                
                res.json({
                    stats,
                    config_count: config.length,
                    sample_config: config.slice(0, 3)
                });
            } catch (error) {
                console.error('Stats error:', error);
                res.status(500).json({ error: 'Failed to get statistics' });
            }
        });
        
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`🚀 CoreDB Test Server running on port ${PORT}`);
            console.log(`✅ CoreDB initialized: ${coreDB.initialized}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            console.log(`🔑 Admin login: POST http://localhost:${PORT}/api/admin/login`);
            console.log(`   Default credentials: sysop_3sdmzl / NewSecretPa55w0rd`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🔄 Shutting down...');
    await coreDB.close();
    process.exit(0);
});

startServer();