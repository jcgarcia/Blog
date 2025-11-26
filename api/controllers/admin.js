import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { getDbPool } from '../db.js';
import CoreDB from '../services/CoreDB.js';

// Get CoreDB singleton instance
const coreDb = CoreDB.getInstance();

// Simple in-memory rate limiting (in production, use Redis or similar)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

// Rate limiting middleware
export const rateLimitLogin = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };

  // Reset if lockout time has passed
  if (now - attempts.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.delete(ip);
    return next();
  }

  // Check if locked out
  if (attempts.count >= MAX_ATTEMPTS) {
    const remainingTime = Math.ceil((LOCKOUT_TIME - (now - attempts.lastAttempt)) / 1000 / 60);
    return res.status(429).json({
      success: false,
      message: `Too many login attempts. Try again in ${remainingTime} minutes.`
    });
  }

  next();
};

// Track failed login attempts
const trackFailedAttempt = (ip) => {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  
  loginAttempts.set(ip, {
    count: attempts.count + 1,
    lastAttempt: now
  });
};

// Clear attempts on successful login
const clearAttempts = (ip) => {
  loginAttempts.delete(ip);
};

// Admin login
export const adminLogin = async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      trackFailedAttempt(ip);
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Log the login attempt (without sensitive data)
    console.log(`Admin login attempt for username: ${username} from IP: ${ip}`);

    let user = null;
    let authSource = 'unknown';

    try {
      // First try CoreDB authentication
      console.log(`🔐 Attempting CoreDB authentication for: ${username}`);
      console.log(`🔧 CoreDB initialized: ${coreDb.initialized}`);
      const coreDbUser = await coreDb.authenticateAdmin(username, password);
      if (coreDbUser) {
        user = {
          id: 1, // Default admin ID for CoreDB
          username: coreDbUser.username,
          email: coreDbUser.email || 'admin@bedtime.ingasti.com',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        };
        authSource = 'CoreDB';
        console.log(`✅ CoreDB authentication successful for: ${username}`);
      } else {
        console.log(`❌ CoreDB authentication failed: User not found or invalid password`);
      }
    } catch (error) {
      console.log(`❌ CoreDB authentication error: ${error.message}`);
      console.log(`🔍 CoreDB connection config - Host: ${coreDb.connectionConfig?.host}, Database: ${coreDb.connectionConfig?.database}`);
    }

    // If CoreDB authentication failed, try legacy PostgreSQL database
    if (!user) {
      try {
        const query = `
          SELECT id, username, email, password_hash, first_name, last_name, role, is_active
          FROM users 
          WHERE (username = $1 OR email = $1) 
          AND role IN ('admin', 'super_admin', 'editor')
          AND is_active = true
        `;

        const result = await getDbPool().query(query, [username]);

        if (result.rows.length > 0) {
          const dbUser = result.rows[0];
          const passwordMatch = await argon2.verify(dbUser.password_hash, password);
          
          if (passwordMatch) {
            user = dbUser;
            authSource = 'PostgreSQL';
            console.log(`PostgreSQL authentication successful for: ${username}`);
            
            // Update last login for PostgreSQL users
            await getDbPool().query(
              'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
              [user.id]
            );
          }
        }
      } catch (error) {
        console.log(`PostgreSQL authentication failed: ${error.message}`);
      }
    }

    // If both authentication methods failed
    if (!user) {
      trackFailedAttempt(ip);
      console.log(`Failed admin login: authentication failed for ${username} from ${ip}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or insufficient permissions'
      });
    }

    // Clear failed attempts on successful login
    clearAttempts(ip);

    // Log successful login
    console.log(`Successful admin login: ${user.username} (${user.role}) from ${ip} via ${authSource}`);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });

  } catch (error) {
    trackFailedAttempt(ip);
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Verify admin token
export const verifyAdminToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    let user = null;

    // If this is a CoreDB admin user (id = 1), use static data
    if (decoded.id === 1) {
      user = {
        id: 1,
        username: decoded.username,
        email: 'admin@bedtime.ingasti.com',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        is_active: true,
        last_login_at: new Date()
      };
    } else {
      // For legacy PostgreSQL users, query the database
      const result = await getDbPool().query(
        `SELECT id, username, email, first_name, last_name, role, is_active, last_login_at
         FROM users 
         WHERE id = $1 AND role IN ('admin', 'super_admin', 'editor') AND is_active = true`,
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token or user not found'
        });
      }

      user = result.rows[0];
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        lastLoginAt: user.last_login_at
      }
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Admin logout
export const adminLogout = async (req, res) => {
  try {
    // In a real implementation, you might want to blacklist the token
    // For now, we'll just return success (client will remove token)
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Middleware to protect admin routes
export const requireAdminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    let user = null;

    // If this is a CoreDB admin user (id = 1), use static data
    if (decoded.id === 1) {
      user = {
        id: 1,
        username: decoded.username,
        role: 'admin',
        is_active: true
      };
    } else {
      // For legacy PostgreSQL users, verify in database
      const result = await getDbPool().query(
        `SELECT id, username, role, is_active
         FROM users 
         WHERE id = $1 AND role IN ('admin', 'super_admin', 'editor') AND is_active = true`,
        [decoded.id]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication or insufficient permissions'
        });
      }

      user = result.rows[0];
    }

    // Add user info to request
    req.adminUser = user;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication expired'
      });
    }

    console.error('Admin auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};
