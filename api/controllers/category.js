import { getDbPool } from "../db.js";
import jwt from "jsonwebtoken";

// Helper function to get or create default category
export const getDefaultCategoryId = async () => {
  const pool = getDbPool();
  try {
    // First, try to find existing default category with ID 0
    let result = await pool.query(
      "SELECT id FROM categories WHERE id = 0 AND is_active = true LIMIT 1"
    );
    
    if (result.rows.length > 0) {
      return 0;
    }
    
    // If no default category exists, create one with ID 0
    console.log('Creating default "Jumble" category with ID 0...');
    const insertResult = await pool.query(`
      INSERT INTO categories (id, name, slug, description, color, sort_order, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [
      0,
      'Jumble',
      'jumble', 
      'Default category for uncategorized posts',
      '#6B7280', // Gray color
      0 // Highest priority sort order
    ]);
    
    console.log('Default category "Jumble" ensured with ID:', insertResult.rows[0].id);
    return 0;
    
  } catch (error) {
    console.error('Error getting/creating default category:', error);
    // If we can't create default category, return null and let the post be saved without category
    return null;
  }
};

export const getCategories = async (req, res) => {
  const pool = getDbPool();
  try {
    // Check if we should exclude Jumble category (for public/reader use)
    const excludeJumble = req.query.exclude_jumble === 'true';
    // Check if we should only show sidebar-visible categories
    const sidebarOnly = req.query.sidebar_only === 'true';
    
    let whereClause = 'WHERE is_active = true';
    if (excludeJumble) {
      whereClause += ' AND id != 0'; // Exclude Jumble category (ID 0)
    }
    if (sidebarOnly) {
      whereClause += ' AND show_in_sidebar = true'; // Only show sidebar-visible categories
    }
    
    const q = `
      SELECT id, name, slug, description, color, parent_id, sort_order, show_in_sidebar,
             (SELECT COUNT(*) FROM posts WHERE category_id = categories.id) as post_count
      FROM categories 
      ${whereClause}
      ORDER BY sort_order ASC, name ASC
    `;
    const result = await pool.query(q);
    
    // If hierarchical structure is requested, organize categories by parent-child relationships
    if (req.query.hierarchical === 'true') {
      const categories = result.rows;
      const parentCategories = categories.filter(cat => !cat.parent_id);
      const childCategories = categories.filter(cat => cat.parent_id);
      
      // Add children to parent categories
      const hierarchicalCategories = parentCategories.map(parent => ({
        ...parent,
        subcategories: childCategories.filter(child => child.parent_id === parent.id)
      }));
      
      return res.status(200).json(hierarchicalCategories);
    }
    
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Database error in getCategories:', err);
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const addCategory = async (req, res) => {
  const pool = getDbPool();
  
  // Check authentication
  const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json("Not authenticated!");
  }
  
  try {
    const userInfo = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Only allow admin/super_admin to create categories
    if (userInfo.role !== 'admin' && userInfo.role !== 'super_admin') {
      return res.status(403).json("You don't have permission to create categories!");
    }
    
    const { name, description, color, parent_id, show_in_sidebar } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json("Category name is required!");
    }
    
    // Generate slug from name
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 100);
    
    // Check if slug exists and make it unique
    let finalSlug = slug;
    let counter = 1;
    while (true) {
      const existingCategory = await pool.query('SELECT id FROM categories WHERE slug = $1', [finalSlug]);
      if (existingCategory.rows.length === 0) {
        break;
      }
      finalSlug = `${slug}-${counter}`;
      counter++;
    }
    
    // Get the next sort order
    const sortOrderResult = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM categories');
    const sortOrder = sortOrderResult.rows[0].next_order;
    
    const q = `
      INSERT INTO categories (name, slug, description, color, parent_id, sort_order, show_in_sidebar, is_active, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
      RETURNING *
    `;
    
    const result = await pool.query(q, [
      name.trim(),
      finalSlug,
      description?.trim() || null,
      color || '#3B82F6',
      parent_id || null,
      sortOrder,
      show_in_sidebar !== undefined ? show_in_sidebar : true
    ]);
    
    return res.status(201).json({
      message: "Category created successfully!",
      category: result.rows[0]
    });
    
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json("Token is not valid!");
    }
    console.error('Database error in addCategory:', err);
    return res.status(500).json({ error: 'Failed to create category' });
  }
};

export const deleteCategory = async (req, res) => {
  const pool = getDbPool();
  
  // Check authentication
  const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json("Not authenticated!");
  }
  
  try {
    const userInfo = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Only allow admin/super_admin to delete categories
    if (userInfo.role !== 'admin' && userInfo.role !== 'super_admin') {
      return res.status(403).json("You don't have permission to delete categories!");
    }
    
    const categoryId = req.params.id;
    
    // Prevent deletion of Jumble category (ID 0)
    if (parseInt(categoryId) === 0) {
      return res.status(400).json({ error: "Cannot delete the default 'Jumble' category!" });
    }
    
    // Check if category exists
    const existingCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
    if (existingCategory.rows.length === 0) {
      return res.status(404).json({ error: "Category not found!" });
    }
    
    // Check if there are posts using this category
    const postsUsingCategory = await pool.query('SELECT COUNT(*) as count FROM posts WHERE category_id = $1', [categoryId]);
    const postCount = parseInt(postsUsingCategory.rows[0].count);
    
    if (postCount > 0) {
      // Move posts to Jumble category (ID 0) before deleting
      await pool.query('UPDATE posts SET category_id = 0 WHERE category_id = $1', [categoryId]);
      console.log(`Moved ${postCount} posts from category ${categoryId} to Jumble category`);
    }
    
    // Check if there are subcategories using this as parent
    const subcategories = await pool.query('SELECT COUNT(*) as count FROM categories WHERE parent_id = $1', [categoryId]);
    const subcategoryCount = parseInt(subcategories.rows[0].count);
    
    if (subcategoryCount > 0) {
      // Remove parent relationship from subcategories
      await pool.query('UPDATE categories SET parent_id = NULL WHERE parent_id = $1', [categoryId]);
      console.log(`Removed parent relationship from ${subcategoryCount} subcategories`);
    }
    
    // Delete the category
    const deleteResult = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [categoryId]);
    
    return res.status(200).json({
      message: "Category deleted successfully!",
      category: deleteResult.rows[0],
      postsReassigned: postCount,
      subcategoriesUpdated: subcategoryCount
    });
    
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json("Token is not valid!");
    }
    console.error('Database error in deleteCategory:', err);
    return res.status(500).json({ error: 'Failed to delete category' });
  }
};

export const updateCategory = async (req, res) => {
  const pool = getDbPool();
  
  // Check authentication
  const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json("Not authenticated!");
  }
  
  try {
    const userInfo = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Only allow admin/super_admin to update categories
    if (userInfo.role !== 'admin' && userInfo.role !== 'super_admin') {
      return res.status(403).json("You don't have permission to update categories!");
    }
    
    const categoryId = req.params.id;
    const { name, description, color, parent_id, show_in_sidebar } = req.body;
    
    // Check if category exists
    const existingCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [categoryId]);
    if (existingCategory.rows.length === 0) {
      return res.status(404).json({ error: "Category not found!" });
    }
    
    // Prevent circular parent relationships
    if (parent_id && parseInt(parent_id) === parseInt(categoryId)) {
      return res.status(400).json({ error: "A category cannot be its own parent!" });
    }
    
    // Generate new slug if name changed
    let finalSlug = existingCategory.rows[0].slug;
    if (name && name.trim() !== existingCategory.rows[0].name) {
      let slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 100);
      
      // Check if slug exists and make it unique
      finalSlug = slug;
      let counter = 1;
      while (true) {
        const existingSlug = await pool.query('SELECT id FROM categories WHERE slug = $1 AND id != $2', [finalSlug, categoryId]);
        if (existingSlug.rows.length === 0) {
          break;
        }
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
    }
    
    const q = `
      UPDATE categories 
      SET name = COALESCE($1, name),
          slug = COALESCE($2, slug),
          description = COALESCE($3, description),
          color = COALESCE($4, color),
          parent_id = $5,
          show_in_sidebar = COALESCE($6, show_in_sidebar),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;
    
    const result = await pool.query(q, [
      name?.trim() || null,
      finalSlug,
      description?.trim() || null,
      color || null,
      parent_id || null,
      show_in_sidebar !== undefined ? show_in_sidebar : null,
      categoryId
    ]);
    
    return res.status(200).json({
      message: "Category updated successfully!",
      category: result.rows[0]
    });
    
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json("Token is not valid!");
    }
    console.error('Database error in updateCategory:', err);
    return res.status(500).json({ error: 'Failed to update category' });
  }
};
