import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../../config/api';
import CognitoLogin from '../cognito-login/CognitoLogin';
import DatabaseManager from './DatabaseManager';
import './cognito-admin.css';

const defaultConfig = {
  userPoolId: '',
  clientId: '',
  clientSecret: '',
  region: '',
  domain: '',
  enabled: false
};

export default function CognitoAdminPanel() {
  const [form, setForm] = useState(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [activeTab, setActiveTab] = useState('config');
  const [debugInfo, setDebugInfo] = useState('');

  // Load current settings
  useEffect(() => {
    loadSettings();
    debugTokenInfo();
  }, []);

  const debugTokenInfo = () => {
    const token = localStorage.getItem('adminToken');
    const userToken = localStorage.getItem('userToken');
    
    let debug = '🔍 Debug Information:\n';
    debug += `- Admin Token: ${token ? 'Present' : 'Missing'}\n`;
    debug += `- User Token: ${userToken ? 'Present' : 'Missing'}\n`;
    debug += `- Current URL: ${window.location.href}\n`;
    debug += `- API Endpoint: ${API_ENDPOINTS.SETTINGS.OAUTH}\n`;
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        debug += `- Token expires: ${new Date(payload.exp * 1000).toLocaleString()}\n`;
        debug += `- Token user ID: ${payload.id}\n`;
        debug += `- Token role: ${payload.role}\n`;
        debug += `- Token expired: ${payload.exp * 1000 < Date.now() ? 'YES' : 'NO'}\n`;
      } catch (e) {
        debug += `- Token parse error: ${e.message}\n`;
      }
    }
    
    setDebugInfo(debug);
    console.log('🔍 [DEBUG] Token Information:', debug);
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      
      console.log('🔍 [DEBUG] Loading Cognito settings...');
      console.log('🔍 [DEBUG] Token exists:', !!token);
      console.log('🔍 [DEBUG] Token length:', token ? token.length : 0);
      console.log('🔍 [DEBUG] API Endpoint:', API_ENDPOINTS.SETTINGS.OAUTH);
      
      if (!token) {
        setMessage('❌ Admin authentication required. Please log in.');
        return;
      }
      
      const response = await fetch(API_ENDPOINTS.SETTINGS.OAUTH, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('🔍 [DEBUG] Response status:', response.status);
      console.log('🔍 [DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 [DEBUG] Response data:', data);
        
        if (data.success && data.config && data.config.cognito) {
          setForm({
            userPoolId: data.config.cognito.userPoolId || '',
            clientId: data.config.cognito.clientId || '',
            clientSecret: data.config.cognito.clientSecret || '',
            region: data.config.cognito.region || '',
            domain: data.config.cognito.domain || '',
            enabled: data.config.cognito.enabled || false
          });
          setMessage('✅ Settings loaded successfully');
        } else {
          setMessage('❌ Invalid response structure from server');
        }
      } else {
        const errorText = await response.text();
        console.log('🔍 [DEBUG] Error response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          setMessage(`❌ Error loading settings: ${errorData.message || 'Unknown error'} (Status: ${response.status})`);
        } catch (parseError) {
          setMessage(`❌ Server error: ${response.status} - ${errorText}`);
        }
      }
    } catch (error) {
      console.error('🔍 [DEBUG] Network error loading Cognito settings:', error);
      setMessage(`❌ Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'enabled') {
      setForm({ ...form, enabled: checked });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('adminToken');
      
      console.log('🔍 [DEBUG] Saving Cognito settings...');
      console.log('🔍 [DEBUG] Token exists:', !!token);
      console.log('🔍 [DEBUG] Form data:', form);
      
      if (!token) {
        setMessage('❌ Admin authentication required. Please log in.');
        return;
      }
      
      const response = await fetch(API_ENDPOINTS.SETTINGS.OAUTH, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cognito: form
        })
      });
      
      console.log('🔍 [DEBUG] Save response status:', response.status);
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage('✅ Cognito configuration saved successfully!');
      } else {
        const errorData = await response.json();
        setMessage(`❌ Error: ${errorData.message || 'Failed to save configuration'}`);
      }
    } catch (error) {
      console.error('Error saving Cognito settings:', error);
      setMessage('❌ Error saving configuration');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!form.userPoolId || !form.clientId || !form.region) {
      setMessage('❌ Please fill in User Pool ID, Client ID, and Region first');
      return;
    }
    
    setLoading(true);
    setTestResult(null);
    
    try {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        setMessage('❌ Admin authentication required. Please log in.');
        return;
      }
      
      const response = await fetch(API_ENDPOINTS.AUTH.COGNITO_TEST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userPoolId: form.userPoolId,
          clientId: form.clientId,
          region: form.region
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTestResult({
          success: true,
          message: '✅ Connection successful!',
          details: data
        });
      } else {
        setTestResult({
          success: false,
          message: `❌ Connection failed: ${data.message}`,
          details: data
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: '❌ Connection test failed',
        details: { error: error.message }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cognito-admin-panel">
      <h2>AWS Cognito Configuration</h2>
      
      {/* Tab Navigation */}
      <div className="cognito-tabs">
        <button 
          className={activeTab === 'config' ? 'active' : ''}
          onClick={() => setActiveTab('config')}
        >
          <i className="fa-solid fa-gear"></i> Configuration
        </button>
        <button 
          className={activeTab === 'demo' ? 'active' : ''}
          onClick={() => setActiveTab('demo')}
        >
          <i className="fa-solid fa-rocket"></i> Live Demo
        </button>
        <button 
          className={activeTab === 'database' ? 'active' : ''}
          onClick={() => setActiveTab('database')}
        >
          <i className="fa-solid fa-database"></i> Database
        </button>
        <button 
          className={activeTab === 'debug' ? 'active' : ''}
          onClick={() => setActiveTab('debug')}
        >
          <i className="fa-solid fa-bug"></i> Debug
        </button>
      </div>

      {activeTab === 'config' ? (
        <div className="config-section">
          {message && (
            <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
      
      <div style={{background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '8px', padding: '16px', marginBottom: '24px'}}>
        <h4 style={{marginTop: 0}}>How to find required values:</h4>
        <ul style={{marginBottom: '8px'}}>
          <li><b>User Pool ID:</b> AWS Console → Cognito → User Pools → select your pool → Pool details.<br/>
            Format: <code>eu-west-2_XXXXXXXXX</code>
          </li>
          <li><b>App Client ID:</b> In your User Pool → App clients → copy the App client ID.<br/>
            Format: <code>xxxxxxxxxxxxxxxxxxxxxxxxxx</code>
          </li>
          <li><b>App Client Secret:</b> In App clients → Show Details → copy App client secret (if enabled).</li>
          <li><b>AWS Region:</b> Shown in the AWS Console URL (e.g., <code>eu-west-2</code>).</li>
          <li><b>Domain:</b> User Pool → Domain name → copy the full domain URL.<br/>
            Format: <code>your-domain.auth.eu-west-2.amazoncognito.com</code>
          </li>
        </ul>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>
            <input 
              type="checkbox" 
              name="enabled" 
              checked={form.enabled} 
              onChange={handleChange} 
            />
            Enable Cognito Authentication
          </label>
        </div>
        
        <div className="form-group">
          <label>
            User Pool ID: *
            <input 
              type="text" 
              name="userPoolId" 
              value={form.userPoolId} 
              onChange={handleChange}
              placeholder="eu-west-2_XXXXXXXXX"
              required
            />
          </label>
        </div>
        
        <div className="form-group">
          <label>
            App Client ID: *
            <input 
              type="text" 
              name="clientId" 
              value={form.clientId} 
              onChange={handleChange}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxx"
              required
            />
          </label>
        </div>
        
        <div className="form-group">
          <label>
            App Client Secret:
            <input 
              type="password" 
              name="clientSecret" 
              value={form.clientSecret} 
              onChange={handleChange}
              placeholder="Optional - only if app client has secret"
            />
          </label>
        </div>
        
        <div className="form-group">
          <label>
            AWS Region: *
            <input 
              type="text" 
              name="region" 
              value={form.region} 
              onChange={handleChange}
              placeholder="eu-west-2"
              required
            />
          </label>
        </div>
        
        <div className="form-group">
          <label>
            Cognito Domain:
            <input 
              type="text" 
              name="domain" 
              value={form.domain} 
              onChange={handleChange}
              placeholder="your-domain.auth.eu-west-2.amazoncognito.com"
            />
          </label>
        </div>
        
        <div className="form-actions">
          <button type="button" onClick={testConnection} disabled={loading}>
            {loading ? 'Testing...' : '🧪 Test Connection'}
          </button>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Saving...' : '💾 Save Configuration'}
          </button>
        </div>
      </form>
      
      {testResult && (
        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
          <h4>Connection Test Result:</h4>
          <p>{testResult.message}</p>
          {testResult.details && (
            <details>
              <summary>Details</summary>
              <pre>{JSON.stringify(testResult.details, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
      
      <div style={{marginTop: '24px', padding: '16px', background: '#e8f4f8', borderRadius: '8px', fontSize: '0.9em'}}>
        <h5>📋 Next Steps After Configuration:</h5>
        <ol>
          <li>Save the configuration above</li>
          <li>Test the connection to verify settings</li>
          <li>Create user accounts in your Cognito User Pool</li>
          <li>Test login from the main blog login page</li>
          <li>Configure user groups and permissions as needed</li>
        </ol>
        
        <p><strong>Login URL:</strong> <code>/login</code> (Cognito option will appear when enabled)</p>
        <p><strong>User Pool Management:</strong> <a href="https://console.aws.amazon.com/cognito/" target="_blank" rel="noopener noreferrer">AWS Cognito Console</a></p>
      </div>
        </div>
      ) : activeTab === 'demo' ? (
        <div className="demo-section">
          <CognitoLogin />
        </div>
      ) : activeTab === 'database' ? (
        <div className="database-section">
          <DatabaseManager />
        </div>
      ) : activeTab === 'debug' ? (
        <div className="debug-section">
          <h3>🔍 Debug Information</h3>
          
          <div className="debug-card">
            <h4>Authentication Status</h4>
            <pre style={{background: '#f5f5f5', padding: '12px', borderRadius: '4px', fontSize: '12px', overflow: 'auto'}}>
              {debugInfo}
            </pre>
          </div>
          
          <div className="debug-card">
            <h4>Recent Error Messages</h4>
            <div style={{background: message.includes('❌') ? '#ffebee' : '#e8f5e8', padding: '12px', borderRadius: '4px', minHeight: '40px'}}>
              {message || 'No recent messages'}
            </div>
          </div>
          
          <div className="debug-card">
            <h4>Quick Actions</h4>
            <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
              <button 
                onClick={debugTokenInfo}
                style={{padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
              >
                🔄 Refresh Debug Info
              </button>
              <button 
                onClick={loadSettings}
                style={{padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
              >
                🔄 Retry Load Settings
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('adminToken');
                  window.location.reload();
                }}
                style={{padding: '8px 16px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
              >
                🚪 Clear Token & Reload
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
