import express from "express";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js"; // Fixed database backup pg_dump issue
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
import coredbRoutes from "./routes/coredb.js";
import emergencyRoutes from "./routes/emergency.js";
import backupRoutes from "./controllers/backup.js";
import cookieParser from "cookie-parser";
import multer from "multer";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import fs from "fs";
import dotenv from "dotenv";
import { loadSystemConfig } from "./middleware/systemConfig.js";
import { closeDbPool, databaseManager } from "./db.js";
import { createHealthCheckEndpoint, createConnectionInfoEndpoint } from "./utils/dbHealthCheck.js";
import { initializeDatabaseMigrations } from "./migrations.js";
import CoreDB from "./services/CoreDB.js";
import backupStorageService from "./services/backupStorageService.js";
import backupSchedulerService from "./services/backupSchedulerService.js";
import AwsSsoRefreshService from "./services/awsSsoRefreshService.js";
import oidcCredentialRefreshService from "./services/oidcCredentialRefreshService.js";

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

// Validate CoreDB environment variables (only credentials needed from Jenkins)
const coredbRequiredVars = ['COREDB_ADMIN_USER', 'COREDB_ADMIN_PASSWORD', 'COREDB_ENCRYPTION_KEY'];
const missingCoredbVars = coredbRequiredVars.filter(varName => !process.env[varName]);

if (missingCoredbVars.length > 0) {
  console.error('❌ Missing required CoreDB credentials!');
  console.error('📝 Required environment variables:', coredbRequiredVars.join(', '));
  console.error('   These should be injected by Jenkins from credential store');
  process.exit(1);
}

console.log('✅ CoreDB credentials loaded successfully');
console.log('🔧 CoreDB-centric architecture - database connections configured through ops panel');

const app = express();

// CORS middleware with CoreDB-driven configuration
app.use(async (req, res, next) => {
  try {
    const coreDB = CoreDB.getInstance();
    const corsOrigins = await coreDB.getConfig('api.cors_origins');
    const allowedOrigins = corsOrigins || [
      process.env.CORS_ORIGIN || "http://localhost:3000",
      "https://bedtime.ingasti.com",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173"  // Vite dev server fallback
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
  } catch (error) {
    console.warn('⚠️ Failed to load CORS config from CoreDB, using fallback:', error.message);
    // Fallback to default origins if CoreDB fails
    const fallbackOrigins = [
      process.env.CORS_ORIGIN || "http://localhost:3000",
      "https://bedtime.ingasti.com",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173"
    ];
    
    const origin = req.headers.origin;
    if (fallbackOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
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

app.use(express.json());
app.use(cookieParser());

// NOTE: System configuration loading moved to after CoreDB initialization
// to prevent circular dependency issues

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use a local uploads directory inside the container
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + file.originalname);
  },
});

const upload = multer({ storage });

app.post("/api/upload", upload.single("file"), function (req, res) {
  const file = req.file;
  res.status(200).json(file.filename);
});

// Configure Passport.js with Google OAuth strategy using CoreDB
async function initializeGoogleOAuth() {
  try {
    const coreDB = CoreDB.getInstance();
    const googleClientId = await coreDB.getConfig('oauth.google_client_id') || process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";
    const googleClientSecret = await coreDB.getConfig('oauth.google_client_secret') || process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET";
    const apiUrl = await coreDB.getConfig('api.url') || "https://bapi.ingasti.com";
    
    const callbackURL = process.env.NODE_ENV === 'production' 
      ? `${apiUrl}/api/auth/google/callback`
      : "/api/auth/google/callback";
    
    passport.use(new GoogleStrategy({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: callbackURL
    }, (accessToken, refreshToken, profile, done) => {
      // Pass the user profile to the next middleware
      done(null, profile);
    }));
    
    console.log('✅ Google OAuth configured with CoreDB settings');
  } catch (error) {
    console.warn('⚠️ Failed to configure Google OAuth from CoreDB, using environment variables:', error.message);
    // Fallback to environment variables
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET",
      callbackURL: process.env.NODE_ENV === 'production' 
        ? "https://bapi.ingasti.com/api/auth/google/callback"
        : "/api/auth/google/callback"
    }, (accessToken, refreshToken, profile, done) => {
      done(null, profile);
    }));
  }
}

// Serialize user (minimal data)
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Initialize Passport.js middleware
app.use(passport.initialize());

// Create uploads directories if they don't exist
const uploadsDir = "./uploads";
const markdownDir = "./uploads/markdown";

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(markdownDir)) {
  fs.mkdirSync(markdownDir, { recursive: true });
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Database health check endpoint
app.get("/health/db", createHealthCheckEndpoint());

// Database connection info endpoint (for debugging)
app.get("/health/db/connections", createConnectionInfoEndpoint());

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({ 
    message: "Bedtime Blog API is running", 
    timestamp: new Date().toISOString() 
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/publish", publishRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/pages", staticPagesRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/database", databaseRoutes);
app.use("/api/likes", likesRoutes);
app.use("/api/social", socialFeaturesRoutes);
app.use("/api/test", testCommentsRoutes);
app.use("/api/views", viewsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/aws", awsRoutes);
app.use("/api/coredb", coredbRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api/emergency", emergencyRoutes);
app.use("/api/backup", backupRoutes);

// Social media sharing routes (for crawlers)
import { socialCrawlerMiddleware } from './middleware/socialCrawler.js';
app.get('/share/post/:id', socialCrawlerMiddleware);
app.get('/share', socialCrawlerMiddleware);

// JSON Error Handling Middleware - Must be after all API routes
// Handle 404 for API endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    message: `Endpoint ${req.method} ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString()
  });
});

// Handle method not allowed (405) for API endpoints
app.use('/api/*', (err, req, res, next) => {
  if (err.status === 405) {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: `Method ${req.method} is not allowed for ${req.originalUrl}`,
      timestamp: new Date().toISOString()
    });
  }
  next(err);
});

// Global error handler for API endpoints
app.use('/api/*', (err, req, res, next) => {
  console.error('API Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  
  res.status(status).json({
    success: false,
    error: err.name || 'ServerError',
    message: message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

/**
 * Initialize default database connections in CoreDB
 * In the CoreDB-centric architecture, database connections are configured manually
 * through the ops panel, not injected from Jenkins
 */
async function initializeDefaultDatabaseConnections(coreDB) {
  try {
    // Check if we already have database connections
    const existingConnections = await coreDB.getDatabaseConnections();
    if (existingConnections.length > 0) {
      console.log(`✅ CoreDB: Found ${existingConnections.length} existing database connections`);
      return;
    }
    
    console.log('⚠️  CoreDB: No database connections configured');
    console.log('   🔧 Database connections must be configured manually through the ops panel');
    console.log('   📝 Use the Database Management interface to add your PostgreSQL connection:');
    console.log('      - Host: blog-postgres-service (internal) or dbdb.ingasti.com (external)');
    console.log('      - Port: 5432');
    console.log('      - Database: blog');
    console.log('      - Username: dbcore_usr_2025');
    console.log('      - Password: DbSecure2025#XpL3vN7wE5xT6gH4uY1zC0');
    console.log('   🌐 Access the ops panel at: /ops');
    
  } catch (error) {
    console.error('❌ Failed to check default database connections:', error);
  }
}

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`Connected! Server running on port ${PORT}`);
  
  // Initialize CoreDB first (essential for admin authentication)
  let coreDBInitialized = false;
  try {
    console.log('🔧 Initializing CoreDB...');
    const coreDB = CoreDB.getInstance();
    await coreDB.initialize();
    console.log('✅ CoreDB initialized successfully');
    coreDBInitialized = true;
    
    // Initialize default database connections from environment variables
    await initializeDefaultDatabaseConnections(coreDB);
    
    // Now that CoreDB is initialized, we can safely load system configuration
    console.log('🔧 Adding system configuration middleware...');
    app.use(loadSystemConfig);
    console.log('✅ System configuration middleware added');
    
    // Initialize Google OAuth with CoreDB configuration
    await initializeGoogleOAuth();
    
  } catch (error) {
    console.error('❌ Failed to initialize CoreDB:', error);
    console.error('🔄 Admin authentication will not work - ops panel inaccessible');
    console.error('🚫 Skipping DataDB operations until CoreDB is fixed');
  }
  
  // Only try DataDB operations if CoreDB initialized successfully
  if (coreDBInitialized) {
    try {
      // Run essential database migrations first
      await initializeDatabaseMigrations();
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.error('❌ Failed to initialize database migrations:', error);
      console.error('🔄 DataDB not configured yet - configure through ops panel');
    }
    
    // Initialize DatabaseManager in background (non-blocking)
    console.log('🔧 Initializing DatabaseManager in background...');
    databaseManager.initialize()
      .then(async () => {
        console.log('✅ DatabaseManager initialized successfully');
        
        // Initialize backup services after database is ready
        try {
          await backupStorageService.initialize();
          console.log('✅ BackupStorageService initialized successfully');
          
          await backupSchedulerService.initialize();
          console.log('✅ BackupSchedulerService initialized successfully');
          console.log('📅 S3-based scheduled backup system is ready');
        } catch (error) {
          console.error('⚠️ Backup services initialization failed:', error.message);
          console.error('🔄 S3 backup functionality may be limited');
        }

        // Initialize OIDC credential auto-refresh service for Kubernetes
        // This runs OUTSIDE the backup services try-catch to ensure it always starts
        try {
          await oidcCredentialRefreshService.start();
          console.log('✅ OIDC credential auto-refresh service started');
        } catch (error) {
          console.error('⚠️ OIDC auto-refresh service failed to start:', error.message);
          console.error('🔄 AWS credentials will need manual refresh');
        }
      })
      .catch((error) => {
        console.error('⚠️ DatabaseManager initialization failed:', error.message);
        console.error('🔄 DataDB not configured - use ops panel to configure');
      });
  } else {
    console.log('⏸️ Skipping DataDB initialization - CoreDB required first');
    console.log('🔧 Fix CoreDB connection to enable full functionality');
  }
  
  // OIDC authentication is handled automatically when needed
  // No manual initialization required for OIDC-based AWS access
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
  await gracefulShutdown();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Starting graceful shutdown...');
  await gracefulShutdown();
});

async function gracefulShutdown() {
  console.log('Closing server...');
  server.close(async (err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    
    try {
      console.log('Server closed. Cleaning up services...');
      
      // Stop OIDC credential refresh service
      oidcCredentialRefreshService.stop();
      
      console.log('Cleaning up database connections...');
      await closeDbPool();
      console.log('Graceful shutdown complete.');
      process.exit(0);
    } catch (error) {
      console.error('Error during cleanup:', error);
      process.exit(1);
    }
  });

  // Force exit after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Graceful shutdown timeout. Forcing exit...');
    process.exit(1);
  }, 30000);
}
