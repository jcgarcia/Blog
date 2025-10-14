import React, { useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
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
        <button 
          className={activeTab === 'content' ? 'active' : ''} 
          onClick={() => setActiveTab('content')}
        >
          <i className="fa-solid fa-file-lines"></i> Content
        </button>
        <button 
          className={activeTab === 'pages' ? 'active' : ''} 
          onClick={() => setActiveTab('pages')}
        >
          <i className="fa-solid fa-file-text"></i> Pages
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''} 
          onClick={() => setActiveTab('users')}
        >
          <i className="fa-solid fa-users"></i> Users
        </button>
        <button 
          className={activeTab === 'social' ? 'active' : ''} 
          onClick={() => setActiveTab('social')}
        >
          <i className="fa-solid fa-share-nodes"></i> Social Media
        </button>
        <button 
          className={activeTab === 'settings' ? 'active' : ''} 
          onClick={() => setActiveTab('settings')}
        >
          <i className="fa-solid fa-gear"></i> Settings
        </button>
        <button 
          className={activeTab === 'analytics' ? 'active' : ''} 
          onClick={() => setActiveTab('analytics')}
        >
          <i className="fa-solid fa-chart-line"></i> Analytics
        </button>
        <button 
          className={activeTab === 'media' ? 'active' : ''} 
          onClick={() => setActiveTab('media')}
        >
          <i className="fa-solid fa-images"></i> Media
        </button>
        <button 
          className={activeTab === 'auth' ? 'active' : ''} 
          onClick={() => setActiveTab('auth')}
        >
          <i className="fa-solid fa-shield-halved"></i> Auth
        </button>
        <button 
          className={activeTab === 'database' ? 'active' : ''} 
          onClick={() => setActiveTab('database')}
        >
          <i className="fa-solid fa-database"></i> Database
        </button>
      </div>

      <div className="ops-content">
        {renderContent()}
      </div>
    </div>
  );
}
