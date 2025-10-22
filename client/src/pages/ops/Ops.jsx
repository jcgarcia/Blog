import React, { useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import { useDatabaseConnection } from '../../contexts/DatabaseConnectionContext';
import { PANEL_CONFIG, getAvailablePanels } from '../../config/panelConfig';
import DatabaseConnectionAlert from '../../components/ops/DatabaseConnectionAlert';
import './ops.css';
import CognitoAdminPanel from '../../components/cognito-admin/CognitoAdminPanel';
import ContentManagement from './components/ContentManagement';
import UserManagement from './components/UserManagement';
import SocialMediaManagement from './components/SocialMediaManagement';
import SiteSettings from './components/SiteSettings';
import Analytics from './components/Analytics';
import MediaManagement from './components/MediaManagement';
import PageManagement from './components/PageManagement';
import DatabaseManagement from './components/DatabaseManagement';

export default function Ops() {
  const [activeTab, setActiveTab] = useState('content');
  const { adminUser, adminLogout } = useAdmin();
  const { hasActiveConnection, connectionLoading } = useDatabaseConnection();
  
  // Get available panels based on database connection status
  const availablePanels = getAvailablePanels(hasActiveConnection);
  
  // If current tab is not available, switch to the first available one
  React.useEffect(() => {
    if (!connectionLoading && !availablePanels.find(panel => panel.id === activeTab)) {
      setActiveTab(availablePanels[0]?.id || 'database');
    }
  }, [hasActiveConnection, connectionLoading, activeTab, availablePanels]);

  const renderContent = () => {
    switch (activeTab) {
      case 'content':
        return <ContentManagement />;
      case 'pages':
        return <PageManagement />;
      case 'users':
        return <UserManagement />;
      case 'social':
        return <SocialMediaManagement />;
      case 'settings':
        return <SiteSettings />;
      case 'analytics':
        return <Analytics />;
      case 'media':
        return <MediaManagement />;
      case 'auth':
        return <CognitoAdminPanel />;
      case 'database':
        return <DatabaseManagement />;
      default:
        return <ContentManagement />;
    }
  };

  return (
    <div className="ops-container">
      <div className="ops-header">
        <h1>Blog Operations Center</h1>
        <p>Manage your blog content and settings</p>
        <div className="admin-info">
          <span>Welcome, {adminUser?.username || 'Admin'}</span>
          <button className="btn-logout" onClick={adminLogout}>
            <i className="fa-solid fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </div>

      <div className="ops-navigation">
        {availablePanels.map(panel => (
          <button 
            key={panel.id}
            className={activeTab === panel.id ? 'active' : ''} 
            onClick={() => setActiveTab(panel.id)}
          >
            <i className={panel.icon}></i> {panel.name}
          </button>
        ))}
      </div>

      <div className="ops-content">
        {!hasActiveConnection && !connectionLoading && <DatabaseConnectionAlert />}
        {renderContent()}
      </div>
    </div>
  );
}
