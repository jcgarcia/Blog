#!/usr/bin/env node

/**
 * Cognito Inspector Script
 * Helps identify the correct Cognito User Pool and provides configuration details
 * 
 * This script will:
 * 1. List all User Pools in your region
 * 2. Get detailed information about each pool
 * 3. List app clients for each pool
 * 4. Show recommended configuration for the blog
 * 
 * Usage: node scripts/cognito-inspector.js [region]
 */

import { CognitoIdentityProviderClient, ListUserPoolsCommand, DescribeUserPoolCommand, ListUserPoolClientsCommand, DescribeUserPoolClientCommand } from '@aws-sdk/client-cognito-identity-provider';

const region = process.argv[2] || 'eu-west-2';
const client = new CognitoIdentityProviderClient({ region });

async function inspectCognito() {
  console.log('🔍 Cognito Inspector for Blog Authentication');
  console.log('='.repeat(50));
  console.log(`📍 Region: ${region}`);
  console.log('');

  try {
    // List all user pools
    console.log('📋 Listing User Pools...');
    const listPoolsCommand = new ListUserPoolsCommand({ MaxResults: 60 });
    const poolsResponse = await client.send(listPoolsCommand);
    
    if (!poolsResponse.UserPools || poolsResponse.UserPools.length === 0) {
      console.log('❌ No User Pools found in this region');
      return;
    }

    console.log(`✅ Found ${poolsResponse.UserPools.length} User Pool(s)`);
    console.log('');

    // Inspect each pool
    for (const pool of poolsResponse.UserPools) {
      await inspectUserPool(pool);
    }

    // Recommendations
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(50));
    
    const blogPools = poolsResponse.UserPools.filter(pool => 
      pool.Name?.toLowerCase().includes('blog') || 
      pool.Name?.toLowerCase().includes('authentication')
    );

    if (blogPools.length === 0) {
      console.log('⚠️  No pools with "blog" or "authentication" in the name found');
      console.log('🔧 Consider creating a new User Pool specifically for your blog');
    } else if (blogPools.length === 1) {
      console.log(`✅ Use this User Pool: ${blogPools[0].Name}`);
      console.log(`   Pool ID: ${blogPools[0].Id}`);
    } else {
      console.log('⚠️  Multiple blog-related pools found:');
      
      // Sort by creation date (most recent first)
      const sortedPools = blogPools.sort((a, b) => 
        new Date(b.CreationDate) - new Date(a.CreationDate)
      );
      
      console.log(`✅ RECOMMENDED: Use the most recent one: ${sortedPools[0].Name}`);
      console.log(`   Pool ID: ${sortedPools[0].Id}`);
      console.log(`   Created: ${sortedPools[0].CreationDate}`);
      console.log('');
      console.log('📋 All blog-related pools:');
      sortedPools.forEach((pool, index) => {
        console.log(`   ${index + 1}. ${pool.Name} (${pool.Id}) - ${pool.CreationDate}`);
      });
    }

  } catch (error) {
    console.error('❌ Error inspecting Cognito:', error.message);
    
    if (error.name === 'UnauthorizedOperation' || error.name === 'AccessDenied') {
      console.log('');
      console.log('🔐 AWS Authentication Required');
      console.log('Make sure you have:');
      console.log('1. AWS CLI configured: aws configure');
      console.log('2. Proper IAM permissions for Cognito');
      console.log('3. Correct region specified');
    }
  }
}

async function inspectUserPool(pool) {
  console.log(`🏊 User Pool: ${pool.Name}`);
  console.log(`   ID: ${pool.Id}`);
  console.log(`   Status: ${pool.Status}`);
  console.log(`   Created: ${pool.CreationDate}`);
  console.log(`   Last Modified: ${pool.LastModifiedDate}`);

  try {
    // Get detailed pool information
    const describeCommand = new DescribeUserPoolCommand({ UserPoolId: pool.Id });
    const poolDetails = await client.send(describeCommand);
    
    const userPool = poolDetails.UserPool;
    console.log(`   Domain: ${userPool.Domain || 'Not configured'}`);
    console.log(`   MFA: ${userPool.MfaConfiguration || 'OFF'}`);
    console.log(`   Auto Verified: ${userPool.AutoVerifiedAttributes?.join(', ') || 'None'}`);
    
    // List app clients
    const clientsCommand = new ListUserPoolClientsCommand({ 
      UserPoolId: pool.Id,
      MaxResults: 60 
    });
    const clientsResponse = await client.send(clientsCommand);
    
    if (clientsResponse.UserPoolClients && clientsResponse.UserPoolClients.length > 0) {
      console.log(`   📱 App Clients (${clientsResponse.UserPoolClients.length}):`);
      
      for (const appClient of clientsResponse.UserPoolClients) {
        await inspectAppClient(pool.Id, appClient);
      }
    } else {
      console.log('   📱 App Clients: None');
    }

  } catch (error) {
    console.log(`   ❌ Error getting details: ${error.message}`);
  }
  
  console.log('');
}

async function inspectAppClient(poolId, appClient) {
  console.log(`      • ${appClient.ClientName || 'Unnamed Client'}`);
  console.log(`        Client ID: ${appClient.ClientId}`);
  console.log(`        Created: ${appClient.CreationDate}`);
  console.log(`        Last Modified: ${appClient.LastModifiedDate}`);

  try {
    // Get detailed client information
    const describeClientCommand = new DescribeUserPoolClientCommand({ 
      UserPoolId: poolId,
      ClientId: appClient.ClientId 
    });
    const clientDetails = await client.send(describeClientCommand);
    
    const client = clientDetails.UserPoolClient;
    console.log(`        Has Secret: ${client.ClientSecret ? 'Yes' : 'No'}`);
    console.log(`        Auth Flows: ${client.ExplicitAuthFlows?.join(', ') || 'None'}`);
    
    if (client.CallbackURLs && client.CallbackURLs.length > 0) {
      console.log(`        Callback URLs: ${client.CallbackURLs.join(', ')}`);
    }
    
  } catch (error) {
    console.log(`        ❌ Error getting client details: ${error.message}`);
  }
}

// Configuration template generator
function generateConfigTemplate(userPoolId, clientId, region) {
  console.log('');
  console.log('🔧 CONFIGURATION TEMPLATE');
  console.log('='.repeat(50));
  console.log('Copy these values to your blog configuration:');
  console.log('');
  console.log(`User Pool ID: ${userPoolId}`);
  console.log(`App Client ID: ${clientId}`);
  console.log(`Region: ${region}`);
  console.log(`Cognito Domain: https://cognito-idp.${region}.amazonaws.com/${userPoolId}`);
  console.log('');
  console.log('Environment Variables for your backend:');
  console.log(`COGNITO_USER_POOL_ID=${userPoolId}`);
  console.log(`COGNITO_CLIENT_ID=${clientId}`);
  console.log(`COGNITO_REGION=${region}`);
}

// Run the inspection
inspectCognito().then(() => {
  console.log('');
  console.log('🎯 Next Steps:');
  console.log('1. Use the recommended User Pool ID and Client ID');
  console.log('2. Configure the values in your Auth panel');
  console.log('3. Test the connection using the "Test Connection" button');
  console.log('4. Set up the environment variables in your backend');
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
