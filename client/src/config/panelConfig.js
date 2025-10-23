/**
 * Operations Panel Configuration
 * Defines which panels require database connections and their metadata
 */

export const PANEL_CONFIG = {
  // CoreDB-only panels (always available - data stored in PostgreSQL CoreDB)
  database: { 
    requiresDatabase: false, 
    icon: '💾', 
    title: 'Database',
    description: 'Manage database connections',
    path: '/ops/database'
  },
  settings: { 
    requiresDatabase: false, 
    icon: '⚙️', 
    title: 'Settings',
    description: 'System configuration',
    path: '/ops/settings'
  },
  media: { 
    requiresDatabase: false, 
    icon: '📁', 
    title: 'Media',
    description: 'File storage management',
    path: '/ops/media'
  },
  auth: { 
    requiresDatabase: false, 
    icon: '🔐', 
    title: 'Auth',
    description: 'Authentication settings',
    path: '/ops/auth'
  },
  
  // DataDB-dependent panels (require PostgreSQL connection)
  content: { 
    requiresDatabase: true, 
    icon: '📝', 
    title: 'Content',
    description: 'Blog posts and articles',
    path: '/ops/content'
  },
  pages: { 
    requiresDatabase: true, 
    icon: '📄', 
    title: 'Pages',
    description: 'Static pages management',
    path: '/ops/pages'
  },
  users: { 
    requiresDatabase: true, 
    icon: '👥', 
    title: 'Users',
    description: 'Blog users and readers',
    path: '/ops/users'
  },
  social: { 
    requiresDatabase: true, 
    icon: '📱', 
    title: 'Social Media',
    description: 'Comments, likes, shares',
    path: '/ops/social'
  },
  analytics: { 
    requiresDatabase: true, 
    icon: '📊', 
    title: 'Analytics',
    description: 'Page views and user behavior',
    path: '/ops/analytics'
  }
};

/**
 * Get available panels based on database connection status
 * @param {boolean} hasActiveConnection - Whether there's an active database connection
 * @returns {Array} Array of available panel configurations
 */
export const getAvailablePanels = (hasActiveConnection) => {
  return Object.entries(PANEL_CONFIG).filter(([key, config]) => 
    !config.requiresDatabase || hasActiveConnection
  );
};

/**
 * Get CoreDB-only panels (always available)
 * @returns {Array} Array of CoreDB panel configurations
 */
export const getCoreDBPanels = () => {
  return Object.entries(PANEL_CONFIG).filter(([key, config]) => 
    !config.requiresDatabase
  );
};

/**
 * Get database-dependent panels
 * @returns {Array} Array of database-dependent panel configurations
 */
export const getDatabaseDependentPanels = () => {
  return Object.entries(PANEL_CONFIG).filter(([key, config]) => 
    config.requiresDatabase
  );
};

/**
 * Check if a panel requires database connection
 * @param {string} panelKey - The panel key to check
 * @returns {boolean} Whether the panel requires database connection
 */
export const panelRequiresDatabase = (panelKey) => {
  return PANEL_CONFIG[panelKey]?.requiresDatabase || false;
};