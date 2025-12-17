import Redis from 'ioredis';

/**
 * Hybrid Image Cache Service using Redis
 * 
 * Implements two-tier caching:
 * 1. Signed URL cache (cold) - Low memory, covers all images
 * 2. Image byte cache (hot) - High memory, only for frequently accessed images
 * 
 * Images are promoted to byte cache after reaching access threshold
 */
class ImageCacheService {
  constructor() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;
    
    // Check if Redis is disabled
    if (redisHost === 'disabled') {
      console.log('⚠️  Redis cache is DISABLED - all requests will bypass cache');
      this.redis = null;
      this.enabled = false;
      return;
    }
    
    try {
      this.redis = new Redis({
        host: redisHost,
        port: parseInt(redisPort),
        retryStrategy: (times) => {
          if (times > 3) {
            console.error('❌ Redis connection failed after 3 retries');
            return null; // Stop retrying
          }
          return Math.min(times * 50, 2000);
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true
      });

      // Connect and handle errors
      this.redis.connect().catch(err => {
        console.error('❌ Redis connection error:', err.message);
        this.enabled = false;
      });

      this.redis.on('connect', () => {
        console.log('✅ Redis connected:', redisHost + ':' + redisPort);
        this.enabled = true;
      });

      this.redis.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
        this.enabled = false;
      });

      this.redis.on('close', () => {
        console.warn('⚠️  Redis connection closed');
        this.enabled = false;
      });

      this.enabled = true;
    } catch (error) {
      console.error('❌ Failed to initialize Redis client:', error.message);
      this.redis = null;
      this.enabled = false;
    }
    
    // Cache configuration
    this.signedUrlTTL = 3600; // 1 hour (match S3 URL expiration)
    this.imageByteTTL = 86400; // 24 hours
    this.promotionThreshold = 10; // Promote after 10 accesses in window
    this.promotionWindow = 300; // 5 minutes
  }

  /**
   * Check if Redis is available and enabled
   */
  isEnabled() {
    return this.enabled && this.redis !== null;
  }

  /**
   * Get signed URL from cache
   */
  async getSignedUrl(s3Key) {
    if (!this.isEnabled()) return null;
    
    try {
      return await this.redis.get(`url:${s3Key}`);
    } catch (error) {
      console.error(`Redis getSignedUrl error for ${s3Key}:`, error.message);
      return null;
    }
  }

  /**
   * Cache signed URL with TTL
   */
  async cacheSignedUrl(s3Key, signedUrl, ttl = this.signedUrlTTL) {
    if (!this.isEnabled()) return false;
    
    try {
      await this.redis.setex(`url:${s3Key}`, ttl, signedUrl);
      return true;
    } catch (error) {
      console.error(`Redis cacheSignedUrl error for ${s3Key}:`, error.message);
      return false;
    }
  }

  /**
   * Get image bytes from cache (hot cache)
   */
  async getImageBytes(s3Key) {
    if (!this.isEnabled()) return null;
    
    try {
      const bytes = await this.redis.getBuffer(`img:${s3Key}`);
      return bytes;
    } catch (error) {
      console.error(`Redis getImageBytes error for ${s3Key}:`, error.message);
      return null;
    }
  }

  /**
   * Cache image bytes with TTL (hot cache)
   */
  async cacheImageBytes(s3Key, buffer, ttl = this.imageByteTTL) {
    if (!this.isEnabled()) return false;
    
    try {
      await this.redis.setex(`img:${s3Key}`, ttl, buffer);
      return true;
    } catch (error) {
      console.error(`Redis cacheImageBytes error for ${s3Key}:`, error.message);
      return false;
    }
  }

  /**
   * Track access frequency for promotion decision
   * Returns the current access count
   */
  async trackAccess(s3Key) {
    if (!this.isEnabled()) return 0;
    
    try {
      const key = `access:${s3Key}`;
      const count = await this.redis.incr(key);
      
      // Set expiry on first access
      if (count === 1) {
        await this.redis.expire(key, this.promotionWindow);
      }
      
      return count;
    } catch (error) {
      console.error(`Redis trackAccess error for ${s3Key}:`, error.message);
      return 0;
    }
  }

  /**
   * Check if image should be promoted to byte cache
   * Tracks access and returns true if threshold is met
   */
  async shouldPromote(s3Key) {
    if (!this.isEnabled()) return false;
    
    try {
      const accessCount = await this.trackAccess(s3Key);
      return accessCount >= this.promotionThreshold;
    } catch (error) {
      console.error(`Redis shouldPromote error for ${s3Key}:`, error.message);
      return false;
    }
  }

  /**
   * Clear all cache entries for a specific S3 key
   * Used when image is updated or deleted
   */
  async invalidate(s3Key) {
    if (!this.isEnabled()) return false;
    
    try {
      await this.redis.del(`url:${s3Key}`, `img:${s3Key}`, `access:${s3Key}`);
      console.log(`🗑️  Cache invalidated for ${s3Key}`);
      return true;
    } catch (error) {
      console.error(`Redis invalidate error for ${s3Key}:`, error.message);
      return false;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getStats() {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        error: 'Redis not available'
      };
    }
    
    try {
      const info = await this.redis.info('stats');
      const memory = await this.redis.info('memory');
      const dbsize = await this.redis.dbsize();
      
      return {
        enabled: true,
        totalKeys: dbsize,
        info: info,
        memory: memory
      };
    } catch (error) {
      console.error('Redis getStats error:', error.message);
      return {
        enabled: false,
        error: error.message
      };
    }
  }

  /**
   * Flush all cache entries (use with caution)
   */
  async flushAll() {
    if (!this.isEnabled()) return false;
    
    try {
      await this.redis.flushall();
      console.log('🗑️  All cache entries flushed');
      return true;
    } catch (error) {
      console.error('Redis flushAll error:', error.message);
      return false;
    }
  }

  /**
   * Close Redis connection (cleanup)
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
      console.log('👋 Redis connection closed');
    }
  }
}

// Export singleton instance
export default new ImageCacheService();
