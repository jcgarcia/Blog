import { getDbPool } from '../db.js';

// Get all static pages (for admin)
export const getAllPages = async (req, res) => {
  try {
    const pool = getDbPool();
    const result = await pool.query(
      'SELECT * FROM static_pages ORDER BY menu_order ASC, title ASC'
    );
    // Gracefully handle invalid Lexical JSON in content field
    const pages = result.rows.map(page => {
      try {
        if (page.content && typeof page.content === 'string') {
          page.content = JSON.parse(page.content);
        }
      } catch (e) {
        // If content is not valid JSON, keep as plain text
      }
      return page;
    });
    res.json({
      success: true,
      pages
    });
  } catch (error) {
    console.error('Error fetching all pages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pages',
      error: error.message
    });
  }
};

// Get active pages for menu
export const getMenuPages = async (req, res) => {
  try {
    const pool = getDbPool();
    const result = await pool.query(
      'SELECT slug, title FROM static_pages WHERE is_published = true AND show_in_menu = true ORDER BY menu_order ASC'
    );
    
    res.json({
      success: true,
      pages: result.rows
    });
  } catch (error) {
    console.error('Error fetching menu pages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching menu pages',
      error: error.message
    });
  }
};

// Get single page by slug
export const getPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const pool = getDbPool();
    const result = await pool.query(
      'SELECT * FROM static_pages WHERE slug = $1 AND is_published = true',
      [slug]
    );
    if (result.rows.length === 0) {
      // If not found, return JSON not HTML
      return res.status(404).json({
        success: false,
        page: null,
        message: 'Page not found'
      });
    }
    // Parse Lexical JSON if possible
    let page = result.rows[0];
    try {
      if (page.content && typeof page.content === 'string') {
        page.content = JSON.parse(page.content);
      }
    } catch (e) {
      // If content is not valid JSON, keep as plain text
    }
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      page
    });
  } catch (error) {
    console.error('Error fetching page by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching page',
      error: error.message
    });
  }
};

// Get single page by ID (for editing)
export const getPageById = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getDbPool();
    const result = await pool.query(
      'SELECT * FROM static_pages WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }
    let page = result.rows[0];
    // If content is Lexical JSON, convert back to plain text for editor
    try {
      if (page.content && typeof page.content === 'string') {
        const parsed = JSON.parse(page.content);
        if (parsed && parsed.root && Array.isArray(parsed.root.children)) {
          // Convert Lexical JSON to plain text blocks
          const blocks = parsed.root.children.map(node => {
            if (node.type === 'heading') return node.children?.map(child => child.text).join(' ');
            if (node.type === 'paragraph') return node.children?.map(child => child.text).join(' ');
            if (node.type === 'list') return node.children?.map(item => '- ' + item.children?.map(child => child.text).join(' ')).join('\n');
            return '';
          });
          page.content = blocks.filter(Boolean).join('\n\n');
        }
      }
    } catch (e) {
      // If not valid JSON, keep as plain text
    }
    res.json({
      success: true,
      page
    });
  } catch (error) {
    console.error('Error fetching page by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching page',
      error: error.message
    });
  }
};

// Create new page
export const createPage = async (req, res) => {
  try {
    const { slug, title, meta_title, meta_description, content, excerpt, is_published, show_in_menu, menu_order } = req.body;
    const userId = req.adminUser.id;

      // Lexical JSON validation or conversion
      let lexicalContent;
      if (typeof content === 'string') {
        try {
          lexicalContent = JSON.parse(content);
        } catch (e) {
          // If not valid JSON, treat as plain text and convert to Lexical JSON with structure
          const blocks = content.split(/\n{2,}/);
          const children = blocks.map(block => {
            const b = block.trim();
            if (!b) return null;
            // Main title
            if (/^(Terms of Service|Privacy Policy)$/i.test(b)) {
              return { type: 'heading', tag: 1, children: [{ type: 'text', text: b }] };
            }
            // Last updated
            if (/^Last updated:/.test(b)) {
              return { type: 'paragraph', children: [{ type: 'text', text: b }] };
            }
            // Section heading
            if (/^\d+\.\s+.+/.test(b)) {
              return { type: 'heading', tag: 2, children: [{ type: 'text', text: b }] };
            }
            // Subheading
            if (/^[A-Z][A-Za-z ]{3,}$/.test(b) && b.length < 40) {
              return { type: 'heading', tag: 3, children: [{ type: 'text', text: b }] };
            }
            // Unordered list
            if (/^(- |\* )/m.test(b)) {
              const items = b.split(/\n/).filter(line => /^(- |\* )/.test(line)).map(line => ({ type: 'listitem', children: [{ type: 'text', text: line.replace(/^(- |\* )/, '') }] }));
              return { type: 'list', listType: 'bullet', children: items };
            }
            // Ordered list
            if (/^(\d+\. )/m.test(b)) {
              const items = b.split(/\n/).filter(line => /^(\d+\. )/.test(line)).map(line => ({ type: 'listitem', children: [{ type: 'text', text: line.replace(/^(\d+\. )/, '') }] }));
              return { type: 'list', listType: 'number', children: items };
            }
            // Paragraph
            return { type: 'paragraph', children: b.split(/\n/).map(line => ({ type: 'text', text: line })) };
          }).filter(Boolean);
          lexicalContent = {
            root: {
              type: 'root',
              children
            }
          };
        }
      } else {
        lexicalContent = content;
      }
      if (!lexicalContent || !lexicalContent.root || !Array.isArray(lexicalContent.root.children)) {
        return res.status(400).json({
          success: false,
          message: 'Content must be valid Lexical JSON or plain text',
        });
      }

    const pool = getDbPool();
    const result = await pool.query(
      `INSERT INTO static_pages 
       (slug, title, meta_title, meta_description, content, excerpt, is_published, show_in_menu, menu_order, created_by, updated_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [slug, title, meta_title, meta_description, JSON.stringify(lexicalContent), excerpt, is_published, show_in_menu, menu_order, userId, userId]
    );
    res.status(201).json({
      success: true,
      message: 'Page created successfully',
      page: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating page:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating page',
      error: error.message
    });
  }
};

// Update existing page
export const updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    let { slug, title, meta_title, meta_description, content, excerpt, is_published, show_in_menu, menu_order } = req.body;
    const userId = req.adminUser.id;
    // Always publish when saving from editor
    is_published = true;
    // Ensure slug is set and not empty
    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      slug = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'untitled';
    }

      // Lexical JSON validation or conversion
      let lexicalContent;
      if (typeof content === 'string') {
        try {
          lexicalContent = JSON.parse(content);
        } catch (e) {
          // If not valid JSON, treat as plain text and convert to Lexical JSON with structure
          const blocks = content.split(/\n{2,}/);
          const children = blocks.map(block => {
            const b = block.trim();
            if (!b) return null;
            // Main title
            if (/^(Terms of Service|Privacy Policy)$/i.test(b)) {
              return { type: 'heading', tag: 1, children: [{ type: 'text', text: b }] };
            }
            // Last updated
            if (/^Last updated:/.test(b)) {
              return { type: 'paragraph', children: [{ type: 'text', text: b }] };
            }
            // Section heading
            if (/^\d+\.\s+.+/.test(b)) {
              return { type: 'heading', tag: 2, children: [{ type: 'text', text: b }] };
            }
            // Subheading
            if (/^[A-Z][A-Za-z ]{3,}$/.test(b) && b.length < 40) {
              return { type: 'heading', tag: 3, children: [{ type: 'text', text: b }] };
            }
            // Unordered list
            if (/^(- |\* )/m.test(b)) {
              const items = b.split(/\n/).filter(line => /^(- |\* )/.test(line)).map(line => ({ type: 'listitem', children: [{ type: 'text', text: line.replace(/^(- |\* )/, '') }] }));
              return { type: 'list', listType: 'bullet', children: items };
            }
            // Ordered list
            if (/^(\d+\. )/m.test(b)) {
              const items = b.split(/\n/).filter(line => /^(\d+\. )/.test(line)).map(line => ({ type: 'listitem', children: [{ type: 'text', text: line.replace(/^(\d+\. )/, '') }] }));
              return { type: 'list', listType: 'number', children: items };
            }
            // Paragraph
            return { type: 'paragraph', children: b.split(/\n/).map(line => ({ type: 'text', text: line })) };
          }).filter(Boolean);
          lexicalContent = {
            root: {
              type: 'root',
              children
            }
          };
        }
      } else {
        lexicalContent = content;
      }
      if (!lexicalContent || !lexicalContent.root || !Array.isArray(lexicalContent.root.children)) {
        return res.status(400).json({
          success: false,
          message: 'Content must be valid Lexical JSON or plain text',
        });
      }

    const pool = getDbPool();
    const result = await pool.query(
      `UPDATE static_pages 
       SET slug = $1, title = $2, meta_title = $3, meta_description = $4, content = $5, 
           excerpt = $6, is_published = $7, show_in_menu = $8, menu_order = $9, updated_by = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 
       RETURNING *`,
      [slug, title, meta_title, meta_description, JSON.stringify(lexicalContent), excerpt, is_published, show_in_menu, menu_order, userId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }
    res.json({
      success: true,
      message: 'Page updated successfully',
      page: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating page',
      error: error.message
    });
  }
};

// Delete page
export const deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pool = getDbPool();
    const result = await pool.query(
      'DELETE FROM static_pages WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Page deleted successfully',
      page: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting page',
      error: error.message
    });
  }
};
