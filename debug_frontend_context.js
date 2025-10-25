#!/usr/bin/env node

/**
 * Debug script to test the frontend context polling behavior
 * This simulates what the DatabaseConnectionContext does
 */

import https from 'https';

function httpsRequest(url, options) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, statusText: res.statusMessage, data }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function testConnectionStatusEndpoint() {
    const adminToken = process.env.ADMIN_TOKEN;
    
    if (!adminToken) {
        console.log('❌ No ADMIN_TOKEN environment variable found');
        console.log('Get token with: TOKEN=$(cat /tmp/token2.txt)');
        return;
    }

    const url = 'https://bapi.ingasti.com/api/database/connection-status';
    
    console.log('🔍 Testing connection-status endpoint...');
    console.log(`URL: ${url}`);
    console.log(`Token: ${adminToken.substring(0, 20)}...`);
    
    try {
        const response = await httpsRequest(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);
        
        if (response.status === 200) {
            const data = JSON.parse(response.data);
            console.log('✅ Response Data:', JSON.stringify(data, null, 2));
            
            // Check what the frontend context should see
            console.log('\n🎯 Frontend Context Analysis:');
            console.log(`hasActiveConnection: ${data.connected || false}`);
            console.log(`activeConnection: ${data.connected ? JSON.stringify({
                name: data.connectionName,
                database: data.database,
                host: data.host,
                port: data.port
            }, null, 2) : null}`);
            console.log(`connectionLoading: false`);
            console.log(`connectionError: null`);
            
        } else {
            console.log('❌ Error Response:', response.data);
        }
        
    } catch (error) {
        console.error('💥 Request failed:', error.message);
    }
}

// Main execution
console.log('🚀 Frontend Context Debug Script');
console.log('================================\n');

testConnectionStatusEndpoint();