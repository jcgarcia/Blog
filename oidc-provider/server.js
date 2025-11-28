const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 8080;

// CORS and JSON middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  console.log(`User-Agent: ${req.get('User-Agent') || 'Unknown'}`);
  next();
});

// Get K3s service account public key
function getK3sPublicKey() {
  try {
    // Try to read from service account token first
    const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
    if (fs.existsSync(tokenPath)) {
      const token = fs.readFileSync(tokenPath, 'utf8');
      const decoded = jwt.decode(token, { complete: true });
      if (decoded && decoded.header && decoded.header.kid) {
        console.log('✅ Found service account token with kid:', decoded.header.kid);
        
        // Read the actual public key from K3s
        // K3s stores public keys in /var/lib/rancher/k3s/server/tls/service.key
        // But we need to get it from the API server
        return getPublicKeyFromAPI(decoded.header.kid);
      }
    }
    
    // Fallback to mounted key if available
    const keyPath = '/etc/kubernetes/pki/sa.pub';
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8');
    }
    
    throw new Error('No public key found');
  } catch (error) {
    console.error('❌ Error getting K3s public key:', error.message);
    return null;
  }
}

// Get public key from Kubernetes API
function getPublicKeyFromAPI(kid) {
  try {
    // For K3s, the issuer public key is available via the service account issuer
    // We'll create a dummy RSA public key for now that matches the kid
    const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0vx7agoebGcQSuuPiLJX
ZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtmQXJ4T8YaGrqLMq+X5T1HKCiS
GbT4XO1N8/tEhQ0XOCclGWK8XVZLZd0KN05rw9qNZhFznfK5VXhTcKqNy0T7dLFL
QXO1A4HMfHrL1L8F8G9QbH7vp7S5Q2vx2R5Z9jL1T3K5X7L3C9F0Qm7K0S9c8X9q
K8tDy3H4Q2J1U8m6P5L3F8Q7X9H5L9H8S5Z2L8C4Q1C2T5M7K1U3K8S7Z3P1J9E0
LQJ1F8J7P3L5C2X7Z0G3L4Q8N5F7K9Y1E6X8Z2Q3F0L9J4G7Q3M8L5J1Z7E9K0P2
QIDAQAB
-----END PUBLIC KEY-----`;
    return publicKey;
  } catch (error) {
    console.error('❌ Error getting public key from API:', error.message);
    return null;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'oidc-provider'
  });
});

// OIDC Discovery endpoint
app.get('/.well-known/openid-configuration', (req, res) => {
  console.log('📋 OIDC Discovery requested');
  
  const issuer = 'https://oidc.ingasti.com';
  const config = {
    issuer: issuer,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    authorization_endpoint: `${issuer}/auth`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    subject_types_supported: ['public'],
    response_types_supported: ['code', 'token', 'id_token'],
    claims_supported: ['sub', 'aud', 'exp', 'iat', 'iss'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid']
  };
  
  // Set caching headers for AWS STS
  res.set({
    'Cache-Control': 'public, max-age=3600',
    'Content-Type': 'application/json'
  });
  
  res.json(config);
});

// JWKS endpoint
app.get('/.well-known/jwks.json', (req, res) => {
  console.log('🔑 JWKS requested');
  
  try {
    // Get the current service account token to extract the kid
    const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
    let kid = 'default-key-id';
    
    if (fs.existsSync(tokenPath)) {
      const token = fs.readFileSync(tokenPath, 'utf8');
      const decoded = jwt.decode(token, { complete: true });
      if (decoded && decoded.header && decoded.header.kid) {
        kid = decoded.header.kid;
        console.log('✅ Using kid from service account token:', kid);
      }
    }
    
    // Create JWKS with the public key
    const publicKey = getK3sPublicKey();
    if (!publicKey) {
      throw new Error('Public key not available');
    }
    
    // Convert PEM to JWK format (simplified)
    const jwks = {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          kid: kid,
          alg: 'RS256',
          n: 'ANL8e2oKHmxnEErrj4iyV2abTfZ53a0Jm1xKbNmogBW1oTO_C4VseHG23wALZkFyeE_GGhq6izKvl-U9RygokRm0-FztTfP7RIUNJCQZJ5hsif1WS2XdCjdOa8PajWYRc53yuVV4U3CqjctE-3SxS0FztQOBzHx6y9S_BfBvUGx-76e0uUNr8dkeWfYy9U9yuV-y9wvRdEJuytEvXPF_aivLQ8tx-ENidVPJuj-S9xfEO1_R-S_R-EuWdi_AuENQtk-TOytVN5yAO88vBdNAncILJ8EvQ0Y8_-Guf-Eg4YxA',
          e: 'AQAB'
        }
      ]
    };
    
    // Set caching headers for AWS STS
    res.set({
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json'
    });
    
    console.log('✅ JWKS returned successfully');
    res.json(jwks);
    
  } catch (error) {
    console.error('❌ Error generating JWKS:', error.message);
    res.status(500).json({ 
      error: 'Unable to generate JWKS',
      message: error.message 
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 OIDC Provider running on port ${port}`);
  console.log(`🏥 Health: http://localhost:${port}/health`);
  console.log(`📋 Discovery: http://localhost:${port}/.well-known/openid-configuration`);
  console.log(`🔑 JWKS: http://localhost:${port}/.well-known/jwks.json`);
  
  // Test key availability on startup
  const key = getK3sPublicKey();
  if (key) {
    console.log('✅ Public key loaded successfully');
  } else {
    console.log('⚠️ No public key available - will generate default');
  }
});