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
import { loadSystemConfig } from "./middleware/systemConfig.js";
import { closeDbPool, databaseManager } from "./db.js";
import { createHealthCheckEndpoint, createConnectionInfoEndpoint } from "./utils/dbHealthCheck.js";
import { initializeDatabaseMigrations } from "./migrations.js";

// Load environment variables for database connection only
dotenv.config({ path: '.env.local' });
dotenv.config();

// Validate PostgreSQL environment variables
const rdsRequiredVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
const containerOptionalVars = ['POSTGRES_CONTAINER_HOST', 'POSTGRES_CONTAINER_USER', 'POSTGRES_CONTAINER_PASSWORD', 'POSTGRES_CONTAINER_DB'];

const missingRdsVars = rdsRequiredVars.filter(varName => !process.env[varName]);
const hasContainerVars = containerOptionalVars.some(varName => process.env[varName]);

if (missingRdsVars.length > 0 && !hasContainerVars) {
  console.error('❌ No valid database configuration found!');
  console.error('📝 Please provide either:');
  console.error('   AWS RDS variables:', rdsRequiredVars.join(', '));
  console.error('   OR Container PostgreSQL variables:', containerOptionalVars.join(', '));
  process.exit(1);
}

if (missingRdsVars.length === 0) {
  console.log('✅ AWS RDS configuration loaded successfully');
}

if (hasContainerVars) {
  console.log('✅ Container PostgreSQL configuration detected');
}

console.log('🔧 Multi-database system initialized - configuration will be loaded from active database');

const app = express();

// CORS middleware with support for HTTPS domains
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.CORS_ORIGIN || "http://localhost:3000",
    "https://bedtime.ingasti.com",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173"  // Vite dev server
  ];
  
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

app.use(express.json());
app.use(cookieParser());

// Load system configuration from database
app.use(loadSystemConfig);

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

// Configure Passport.js with Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET",
  callbackURL: process.env.NODE_ENV === 'production' 
    ? "https://bapi.ingasti.com/api/auth/google/callback"
    : "/api/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  // Pass the user profile to the next middleware
  done(null, profile);
}));

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
app.use("/api/meta", metaRoutes);

// Social media sharing routes (for crawlers)
import { socialCrawlerMiddleware } from './middleware/socialCrawler.js';
app.get('/share/post/:id', socialCrawlerMiddleware);
app.get('/share', socialCrawlerMiddleware);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
  console.log(`Connected! Server running on port ${PORT}`);
  
  try {
    // Run essential database migrations first
    await initializeDatabaseMigrations();
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Failed to initialize database migrations:', error);
    console.error('🔄 Application will continue but some features may not work properly');
  }
  
  // Initialize DatabaseManager in background (non-blocking)
  console.log('🔧 Initializing DatabaseManager in background...');
  databaseManager.initialize()
    .then(() => {
      console.log('✅ DatabaseManager initialized successfully');
    })
    .catch((error) => {
      console.error('⚠️ DatabaseManager initialization failed:', error.message);
      console.error('🔄 Falling back to standard database connection');
    });
  
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
      console.log('Server closed. Cleaning up database connections...');
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
