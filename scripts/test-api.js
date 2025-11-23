#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { getDbPool } from './api/db.js';

const app = express();
const port = 5001; // Use different port to avoid conflicts

// CORS middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get all posts
app.get('/api/posts', async (req, res) => {
  const pool = getDbPool();
  try {
    const q = "SELECT * FROM posts ORDER BY created_at DESC";
    const result = await pool.query(q);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Database error in getPosts:', err);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post - FIXED VERSION
app.get('/api/posts/:id', async (req, res) => {
  const pool = getDbPool();
  try {
    const q = "SELECT * FROM posts WHERE id = $1";
    const result = await pool.query(q, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Database error in getPost:', err);
    return res.status(500).json({ error: 'Failed to fetch post' });
  }
});

const server = app.listen(port, () => {
  console.log(`🚀 Test API server running on http://localhost:${port}`);
  console.log(`✅ Database connected and ready`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
  
  // Close the HTTP server
  server.close(async () => {
    console.log('🔌 HTTP server closed');
    
    // Close database connections
    try {
      const { closeDbPool } = await import('./api/db.js');
      await closeDbPool();
      console.log('💾 Database connections closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon
