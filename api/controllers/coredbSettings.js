import CoreDB from '../services/CoreDB.js';

// Initialize CoreDB instance
const coreDB = new CoreDB();

// Get social media links - reads from CoreDB
export const getSocialMediaLinks = async (req, res) => {
  try {
    if (!coreDB.pool) {
      await coreDB.initialize();
    }

    // Query CoreDB's system_config table for social media links
    const result = await coreDB.pool.query(`
      SELECT key, config_value 
      FROM system_config 
      WHERE key IN ('social_linkedin_url', 'social_twitter_url', 'social_instagram_url', 'social_threads_url')
      AND is_public = true
    `);
    
    const socialLinks = {
      linkedin: '',
      twitter: '',
      instagram: '',
      threads: ''
    };
    
    result.rows.forEach(row => {
      let value = row.config_value;
      
      // Parse JSON value if it's a string
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If it's not JSON, use as is
        }
      }
      
      switch (row.key) {
        case 'social_linkedin_url':
          socialLinks.linkedin = value || '';
          break;
        case 'social_twitter_url':
          socialLinks.twitter = value || '';
          break;
        case 'social_instagram_url':
          socialLinks.instagram = value || '';
          break;
        case 'social_threads_url':
          socialLinks.threads = value || '';
          break;
      }
    });
    
    console.log('📱 Social media links fetched from CoreDB:', socialLinks);
    res.status(200).json(socialLinks);
  } catch (error) {
    console.error("Error fetching social media links from CoreDB:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch social links",
      error: error.message 
    });
  }
};

// Get public settings - reads from CoreDB
export const getSettings = async (req, res) => {
  try {
    if (!coreDB.pool) {
      await coreDB.initialize();
    }

    // Query CoreDB's system_config table for public settings
    const result = await coreDB.pool.query(`
      SELECT key, config_value, config_type 
      FROM system_config 
      WHERE is_public = true
      ORDER BY key
    `);
    
    // Convert settings array to object for easier frontend use
    const settings = {};
    result.rows.forEach(row => {
      let value = row.config_value;
      
      // Parse value based on type
      if (row.config_type === 'boolean') {
        value = value === 'true' || value === true;
      } else if (row.config_type === 'number') {
        value = parseFloat(value);
      } else if (row.config_type === 'json') {
        try {
          value = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
          console.error(`Error parsing JSON setting ${row.key}:`, e);
        }
      } else if (typeof value === 'string') {
        // Handle JSON-encoded strings
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If it's not JSON, use as is
        }
      }
      
      settings[row.key] = value;
    });
    
    console.log('⚙️ Public settings fetched from CoreDB:', Object.keys(settings));
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching settings from CoreDB:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch categories",
      error: error.message 
    });
  }
};

// Get all settings including admin-only ones (admin only)
export const getAllSettings = async (req, res) => {
  try {
    if (!coreDB.pool) {
      await coreDB.initialize();
    }

    // Query CoreDB's system_config table for all settings
    const result = await coreDB.pool.query(`
      SELECT key, config_value, config_type, group_name, description, is_public
      FROM system_config 
      ORDER BY group_name, key
    `);
    
    // Convert settings array to object for easier frontend use
    const settings = {};
    result.rows.forEach(row => {
      let value = row.config_value;
      
      // Parse value based on type
      if (row.config_type === 'boolean') {
        value = value === 'true' || value === true;
      } else if (row.config_type === 'number') {
        value = parseFloat(value);
      } else if (row.config_type === 'json') {
        try {
          value = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
          console.error(`Error parsing JSON setting ${row.key}:`, e);
        }
      } else if (typeof value === 'string') {
        // Handle JSON-encoded strings
        try {
          value = JSON.parse(value);
        } catch (e) {
          // If it's not JSON, use as is
        }
      }
      
      // Use camelCase for frontend
      const camelKey = row.key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      settings[camelKey] = value;
    });
    
    console.log('⚙️ All settings fetched from CoreDB:', Object.keys(settings));
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching all settings from CoreDB:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch settings",
      error: error.message 
    });
  }
};

// Update social media links
export const updateSocialMediaLinks = async (req, res) => {
  try {
    if (!coreDB.pool) {
      await coreDB.initialize();
    }

    const { linkedin, twitter, instagram, threads } = req.body;
    
    const updates = [
      { key: 'social_linkedin_url', value: linkedin || '' },
      { key: 'social_twitter_url', value: twitter || '' },
      { key: 'social_instagram_url', value: instagram || '' },
      { key: 'social_threads_url', value: threads || '' }
    ];
    
    for (const update of updates) {
      await coreDB.pool.query(`
        INSERT INTO system_config (key, config_value, config_type, group_name, is_public, created_at, updated_at)
        VALUES ($1, $2, 'string', 'social', true, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        updated_at = NOW()
      `, [update.key, JSON.stringify(update.value)]);
    }
    
    console.log('📱 Social media links updated in CoreDB');
    res.status(200).json({ 
      success: true,
      message: "Social media links updated successfully",
      links: { linkedin, twitter, instagram, threads }
    });
  } catch (error) {
    console.error("Error updating social media links in CoreDB:", error);
    res.status(500).json({ 
      success: false,
      message: "Error updating social media links" 
    });
  }
};

// Update settings (admin only)
export const updateSettings = async (req, res) => {
  try {
    if (!coreDB.pool) {
      await coreDB.initialize();
    }

    const updates = req.body;
    
    for (const [key, value] of Object.entries(updates)) {
      let stringValue;
      let type = 'string';
      
      // Determine type and ensure proper JSON encoding
      if (typeof value === 'boolean') {
        type = 'boolean';
        stringValue = JSON.stringify(value.toString());
      } else if (typeof value === 'number') {
        type = 'number';
        stringValue = JSON.stringify(value.toString());
      } else if (typeof value === 'object') {
        type = 'json';
        stringValue = JSON.stringify(value);
      } else {
        // String values also need to be JSON encoded
        stringValue = JSON.stringify(value);
      }
      
      await coreDB.pool.query(`
        INSERT INTO system_config (key, config_value, config_type, group_name, is_public, created_at, updated_at)
        VALUES ($1, $2, $3, 'general', true, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        config_type = EXCLUDED.config_type,
        updated_at = NOW()
      `, [key, stringValue, type]);
    }
    
    console.log('⚙️ Settings updated in CoreDB:', Object.keys(updates));
    res.status(200).json({ 
      success: true,
      message: "Settings updated successfully" 
    });
  } catch (error) {
    console.error("Error updating settings in CoreDB:", error);
    res.status(500).json({ 
      success: false,
      message: "Error updating settings" 
    });
  }
};

export default {
  getSocialMediaLinks,
  getSettings,
  getAllSettings,
  updateSocialMediaLinks,
  updateSettings
};