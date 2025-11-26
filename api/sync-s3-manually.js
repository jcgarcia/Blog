#!/usr/bin/env node

// Manual S3 sync script to populate media library
import { syncS3ToDatabase } from './controllers/sync.js';

console.log('🔄 Starting manual S3 sync...');

// Mock request/response objects
const mockReq = {};
const mockRes = {
  status: (code) => ({
    json: (data) => {
      console.log(`Response ${code}:`, data);
      process.exit(code === 200 ? 0 : 1);
    }
  })
};

try {
  await syncS3ToDatabase(mockReq, mockRes);
} catch (error) {
  console.error('❌ Sync failed:', error);
  process.exit(1);
}